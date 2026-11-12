# Multi-tenant, fase 1 (esquema de base de datos): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un esquema multi-tenant en `supabase/migrations/`, con aislamiento por fraccionamiento garantizado por RLS y demostrado con pruebas pgTAP en verde, más un `seed.sql` con el super admin local.

**Architecture:** Una sola base. Las tablas de negocio llevan `fraccionamiento_id`, con llaves foráneas compuestas `(id, fraccionamiento_id)` para impedir referencias cruzadas entre fraccionamientos. Las políticas RLS usan tres funciones `security definer` del esquema `private`, que leen `perfiles` con `auth.uid()`. Las vistas son `security_invoker`. La lógica de negocio (triggers, `generar_cuotas`, `marcar_cuotas_vencidas` con `pg_cron`) se reescribe a partir de `supabase/reference/lago-amadeo-schema.sql`.

**Tech Stack:** Supabase CLI 2.110 (Postgres 17 local), PL/pgSQL, pgTAP (`supabase test db`), `pg_cron`.

**Spec:** `docs/superpowers/specs/2026-11-09-multitenant-design.md` (secciones 1 y 2). Referencia del esquema actual: `supabase/reference/lago-amadeo-schema.sql`.

## Global Constraints

- **No hacer commits.** El usuario hace todos los commits. Los pasos "Commit" de este plan solo dicen qué archivos quedan listos.
- **Nunca escribir en Lago Amadeo.** El servidor MCP `lago-amadeo-readonly` es solo de consulta. No se usa `apply_migration` ni `supabase db push`.
- **Migraciones:** cada archivo se crea con `supabase migration new <nombre>`. Nunca se inventa el nombre del archivo. Se aplican con `supabase db reset`, que borra la base local actual (el esquema de referencia y `admin@local.test`). Eso es lo esperado; existe un respaldo en `~/dev/app-fraccionamiento-vacia/backups/`.
- **Stack local:** puertos 553xx (API 55321, base 55322). Si `supabase start` falla por salud de contenedores, usar `supabase start -x logflare,vector,imgproxy`.
- **No tocar `src/`** ni regenerar `database.types.ts` en esta fase. La app deja de funcionar contra la base nueva hasta la fase 2; es esperado.
- **Nombres:** se conservan los nombres de tablas y columnas del esquema de referencia, salvo lo que el spec cambia (`users` y `user_roles` → `perfiles`; `roles` → enum `rol_usuario`).
- **Seguridad en todo objeto de `public`:**
  - RLS habilitado en cada tabla. Ninguna política `using (true)`.
  - GRANT explícito solo a `authenticated` y `service_role`. `anon` no recibe nada. Ojo: el CLI local sí da por defecto TRUNCATE, REFERENCES, TRIGGER y MAINTAIN a `anon` y `authenticated` en tablas nuevas (TRUNCATE ignora RLS); la migración de la tarea 1 los quita con `alter default privileges` y cada migración, además, hace `revoke all … from anon, authenticated` sobre sus objetos antes de sus GRANT.
  - Toda función lleva `set search_path = ''` y nombres calificados (`public.cuotas`, `private.rol_actual()`).
  - `security definer` solo en las funciones de `private`.
- **Llamadas en políticas:** siempre envueltas en `(select …)`, por ejemplo `(select private.fraccionamiento_actual())`.
- **Ids fijos de catálogos globales** (los usan funciones y la app): `estatus` 1=Pendiente, 2=Pagado, 3=Vencido; `tipos_movimientos` 1=Ingreso, 2=Egreso; `tipo_pago` 1=recurrente, 2=extra; `metodos_pago` 1=Efectivo, 2=Transferencia.
- **Verificación de cada tarea:** `supabase db reset && supabase test db` sin fallas.

## Catálogos: qué es global y qué es por fraccionamiento

- **Por fraccionamiento** (los edita el Administrador en Configuración): tipos de cuota (`conceptos_pago` con `tipo_pago_id = 1`, más `concepto_pago_acceso`), conceptos extra (`conceptos_pago` con `tipo_pago_id = 2`), descuentos (`conceptos_descuento`) y recargos (`conceptos_recargo`).
- **Globales** (listas fijas del sistema, solo lectura): `estatus`, `meses`, `anios`, `metodos_pago`, `tipo_pago` y `tipos_movimientos`.

## Decisiones tomadas en este plan (no estaban en el spec)

1. **Catálogos globales en la migración, no en `seed.sql`.** El seed no corre en `db push`, y las funciones dependen de esos ids.
2. **Lecturas de vigilancia.** El spec dice que vigilancia lee "domicilios, residentes y accesos". Las vistas de accesos (`accesos_telefono_info`, `accesos_tarjeta_info`) y `domicilios_info` hacen join con `cuotas`, `conceptos_pago`, `concepto_pago_acceso` y `domicilio_concepto`, así que vigilancia también lee esas cuatro tablas. No lee pagos, movimientos, descuentos ni recargos.
3. **Cuarta función de apoyo** `private.tiene_rol(roles rol_usuario[]) returns boolean`, para que las políticas sean cortas y uniformes.
4. **Utilidades de prueba** en el esquema `tests`, creado por el primer archivo de pruebas (`000-setup.test.sql`). Es solo local; no va en migraciones.
5. **`users_info` cambia de forma:** `(id, email, user_name, is_active, created_at, rol, fraccionamiento_id)`. Desaparecen `role_id` y `role_name`. La fase 2 adapta la app.

## Matriz de permisos (fuente de verdad para las tareas 4 y 5)

`L` = leer, `E` = insertar, actualizar y borrar. Super admin: `L` + `E` en todo. Siempre limitado al fraccionamiento del usuario.

| Tabla | administrador | tesorero | comite | vigilancia |
|---|---|---|---|---|
| `domicilios`, `domicilio_concepto`, `residentes`, `telefonos_acceso`, `tarjetas_acceso` | L E | L | L | L |
| `conceptos_pago`, `concepto_pago_acceso` | L E | L | L | L |
| `conceptos_descuento`, `conceptos_recargo` | L E | L | L | — |
| `cuotas` | L E | L E | L | L |
| `descuento_cuota`, `recargo_cuota`, `pagos`, `movimientos_financieros` | L E | L E | L | — |

## Review Focus

1. **Super admin inserta sin `fraccionamiento_id`.** El default devuelve null y la inserción falla con violación de `not null`, no se guarda en un fraccionamiento al azar. Con el id explícito sí guarda. Prueba en la tarea 4.
2. **Fraccionamiento desactivado con sesión abierta.** Sus usuarios dejan de leer cualquier fila en la siguiente consulta, sin esperar a cerrar sesión. Prueba en la tarea 2 (funciones) y en la tarea 4 (tablas).
3. **Un administrador intenta moverse o promoverse por `update`.** Cambiar `perfiles.fraccionamiento_id` a otro fraccionamiento o `rol` a `super_admin` es rechazado. Prueba en la tarea 2.
4. **Un usuario de A cambia el `fraccionamiento_id` de su propia fila a B.** El `with check` lo rechaza. Prueba en la tarea 4.
5. **`generar_cuotas` dos veces para el mismo mes, o desde A con B lleno de domicilios.** No duplica cuotas y no crea nada en B. Prueba en la tarea 6.

---

### Task 1: Catálogos globales

**Files:**
- Create: `supabase/migrations/<ts>_catalogos_globales.sql` (con `supabase migration new catalogos_globales`)
- Create: `supabase/tests/database/010-catalogos-globales.test.sql`

**Interfaces:**
- Produces: tablas `public.estatus`, `meses`, `anios`, `metodos_pago`, `tipo_pago`, `tipos_movimientos`, con las mismas columnas que en la referencia y los mismos datos (sección 9 de la referencia).

- [ ] **Step 1: Escribir la prueba**

`begin; select plan(5); … select * from finish(); rollback;` con:
```sql
select results_eq('select id, name from public.estatus order by id',
  $$values (1::bigint,'Pendiente'),(2,'Pagado'),(3,'Vencido')$$, 'estatus con ids fijos');
select results_eq('select count(*)::int from public.anios', 'values (11)', '11 años');
set local role authenticated;
select isnt_empty('select 1 from public.meses', 'authenticated lee meses');
select throws_ok('insert into public.meses (name) values (''X'')', '42501', null, 'authenticated no escribe catálogos');
reset role; set local role anon;
select throws_ok('select 1 from public.meses', '42501', null, 'anon no lee catálogos');
```

- [ ] **Step 2: Correr y ver que falla:** `supabase db reset && supabase test db` → FAIL (`relation "public.estatus" does not exist`).

- [ ] **Step 3: Escribir la migración.** Tablas copiadas de la referencia, `insert … overriding system value` con los datos de la sección 9 y `select setval` de cada secuencia al máximo id. RLS habilitado, una política `<tabla>_select` `for select to authenticated using (true)`; esta es la única excepción permitida a "sin `using (true)`", porque son datos globales de solo lectura. `grant select` a `authenticated`; `grant all` a `service_role`.

- [ ] **Step 4: Correr:** `supabase db reset && supabase test db` → PASS.

- [ ] **Step 5: Listo para commit:** la migración y la prueba.

---

### Task 2: Fraccionamientos, perfiles, funciones de apoyo y utilidades de prueba

**Files:**
- Create: `supabase/migrations/<ts>_fraccionamientos_perfiles.sql`
- Create: `supabase/tests/database/000-setup.test.sql`
- Create: `supabase/tests/database/020-fraccionamientos-perfiles.test.sql`

**Interfaces:**
- Produces:
  - `create type public.rol_usuario as enum ('super_admin','administrador','tesorero','comite','vigilancia')`.
  - `public.fraccionamientos (id bigint identity pk, nombre text not null, slug text not null unique, instalacion_id uuid unique, activo boolean not null default true, created_at timestamptz not null default now())`. `instalacion_id` es opcional: id de la instalación de Access Core para la integración futura del spec. CHECK de slug: `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`.
  - `public.perfiles (id uuid pk references auth.users on delete cascade, fraccionamiento_id bigint references public.fraccionamientos, rol public.rol_usuario not null, nombre text not null, email text not null, activo boolean not null default true, created_at timestamptz not null default now())`. CHECK `(rol = 'super_admin') = (fraccionamiento_id is null)`. Índice en `fraccionamiento_id`.
  - Esquema `private` (sin exponer). Funciones `language sql stable security definer set search_path = ''`:
    - `private.fraccionamiento_actual() returns bigint`
    - `private.rol_actual() returns public.rol_usuario`
    - `private.es_super_admin() returns boolean` (nunca null: `coalesce(…, false)`)
    - `private.tiene_rol(roles public.rol_usuario[]) returns boolean`: `rol_actual() = any(roles)`, también nunca null.

    Las cuatro solo consideran el perfil de `auth.uid()` con `activo` en verdadero y, si no es super admin, con su fraccionamiento activo. Si no se cumple, devuelven null o false.
  - `grant usage on schema private to authenticated, service_role`; `grant execute` de las cuatro a `authenticated, service_role`; `revoke execute … from public, anon`.
  - Utilidades de prueba en `tests` (las crea `000-setup.test.sql` con `create schema if not exists` y `create or replace`, sin transacción para que persistan; ese archivo termina con `select plan(1); select pass('utilidades listas'); select * from finish();`):
    - `tests.crear_escenario() returns void`: fraccionamientos `fracc-a`, `fracc-b` (activos) y `fracc-c` (inactivo). Usuarios `<rol>.<a|b>@test.local` para los 4 roles en A y B; `admin.c@test.local` en C; `inactivo.a@test.local` (administrador de A, `activo = false`); `super@test.local` (super_admin). Inserta en `auth.users (id, email, aud, role)` y en `perfiles`.
    - `tests.fid(slug text) returns bigint`, `tests.uid(email text) returns uuid`.
    - `tests.autenticar_como(email text) returns void`: `set_config('role','authenticated',true)` y `set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)`.
    - `grant usage on schema tests` y `execute` de sus funciones a `authenticated`.

- [ ] **Step 1: Escribir `000-setup.test.sql` y `020-fraccionamientos-perfiles.test.sql`.** El segundo hace `begin; select tests.crear_escenario();` y prueba:
  - `fraccionamiento_actual()` como `admin.a` = `tests.fid('fracc-a')`; como `super` es null; como `inactivo.a` es null; como `admin.c` es null.
  - `rol_actual()` como `tesorero.b` = `'tesorero'`; `es_super_admin()` como `super` es true y como `admin.a` es false.
  - Como `admin.a`: `select count(*) from perfiles` = 5 (los 4 roles de A más `inactivo.a`; ninguno de B ni el super admin).
  - Como `comite.a`: solo ve su propio perfil (count = 1).
  - Como `admin.a`: `update perfiles set rol='super_admin'` sobre `tesorero.a` → `throws_ok(…, '42501')`; cambiar el `fraccionamiento_id` de `tesorero.a` a `fracc-b` → `throws_ok(…, '42501')`.
  - Como `admin.a`: `insert` de un perfil con `rol='super_admin'` → `throws_ok(…, '42501')`.
  - Como `admin.a`: `select nombre from fraccionamientos` = solo `fracc-a`; `update fraccionamientos` afecta 0 filas.
  - Como `super`: ve los 3 fraccionamientos y puede `insert` uno nuevo.
  - Como `super`: `update fraccionamientos set instalacion_id = gen_random_uuid()` en A afecta 1 fila; asignar ese mismo UUID a B → `throws_ok(…, '23505')`. Como `admin.a`, el mismo `update` afecta 0 filas.
  - CHECK: `insert` de un perfil `administrador` sin `fraccionamiento_id` como postgres → `throws_ok(…, '23514')`.
  - Desactivar `fracc-a` (como postgres) dentro de la transacción → como `admin.a`, `fraccionamiento_actual()` es null y `select count(*) from perfiles` = 1, solo su propio perfil (Review Focus 2).

- [ ] **Step 2: Correr y ver que falla:** `supabase db reset && supabase test db` → FAIL (`type "public.rol_usuario" does not exist`).

- [ ] **Step 3: Escribir la migración** con lo de Interfaces y estas políticas (`to authenticated`):
  - `fraccionamientos`: `select` si `id = (select private.fraccionamiento_actual())` o super admin. `insert/update/delete` solo super admin.
  - `perfiles`:
    - `select` si es el propio perfil (`id = (select auth.uid())`), si es super admin, o si es administrador del mismo fraccionamiento.
    - `insert/update` si es super admin, o si es administrador, la fila es de su fraccionamiento y `rol <> 'super_admin'`, tanto en `using` como en `with check`.
    - `delete` solo super admin.
  - Grants: `select, insert, update, delete` a `authenticated`; `all` a `service_role`.

- [ ] **Step 4: Correr:** `supabase db reset && supabase test db` → PASS.

- [ ] **Step 5: Listo para commit:** migración y las dos pruebas.

---

### Task 3: Tablas de negocio y restricciones

**Files:**
- Create: `supabase/migrations/<ts>_tablas_negocio.sql`
- Create: `supabase/tests/database/030-tablas-negocio.test.sql`

**Interfaces:**
- Consumes: `private.fraccionamiento_actual()`, `public.perfiles`, catálogos globales.
- Produces: las 14 tablas de la matriz, con las columnas de la referencia más `fraccionamiento_id bigint not null default private.fraccionamiento_actual() references public.fraccionamientos`. RLS habilitado y **sin políticas** en esta tarea (todo queda denegado para `authenticated` hasta la tarea 4).
  - Cada tabla: `constraint <tabla>_id_fraccionamiento_key unique (id, fraccionamiento_id)` y un índice en `fraccionamiento_id`.
  - FKs entre tablas de negocio, compuestas: `(x_id, fraccionamiento_id) references <padre>(id, fraccionamiento_id)`, con el mismo `on update/on delete` que la referencia.
  - FKs a catálogos globales: simples.
  - `domicilios.created_by`, `pagos.user_id` y `movimientos_financieros.user_id`: `references public.perfiles(id)`.
  - Únicos:
    - `domicilios (fraccionamiento_id, direccion)`
    - índice único `(fraccionamiento_id, lower(nombre))` en `conceptos_descuento` y `conceptos_recargo`
    - `(fraccionamiento_id, tipo_pago_id, lower(nombre))` en `conceptos_pago`
    - `concepto_pago_acceso (concepto_pago_id)`, `domicilio_concepto (domicilio_id)`, `descuento_cuota (cuota_id)`, `recargo_cuota (cuota_id)`
    - `cuotas (domicilio_id, concepto_id, anio, mes)`
  - Índice en cada columna FK que no encabece ya un índice.
  - `tests.crear_datos_negocio() returns void` (se agrega a `000-setup.test.sql`): para A y B, como postgres, inserta una fila en cada una de las 14 tablas con `fraccionamiento_id` explícito. Direcciones `Calle A 1` / `Calle B 1`; concepto recurrente `Mensual A` / `Mensual B`; una cuota de 2026-01 pendiente; un pago con `importe = 0`, `cuota_id` null (pago extra, no ligado a la cuota de 2026-01, para que la tarea 6 pueda marcarla vencida) y `user_id` del tesorero de su fraccionamiento (con importe 0 el trigger de la tarea 6 no crea movimiento, así las cuentas de la tarea 4 no cambian); un movimiento explícito `tipo_id = 1`, `importe = 1000`.

- [ ] **Step 1: Escribir la prueba** (como postgres, después de `crear_escenario()` y `crear_datos_negocio()`):
  - `has_table` para las 14 tablas y `col_not_null(…, 'fraccionamiento_id')` en cada una.
  - Cuota en A con `domicilio_id` de B → `throws_ok(…, '23503')`.
  - Domicilio `Calle A 1` repetido en A → `'23505'`; `Calle A 1` en B → `lives_ok`.
  - Concepto de pago `mensual a` con `tipo_pago_id = 1` en A, cuando ya existe `Mensual A` → `'23505'`; el mismo nombre con `tipo_pago_id = 2` → `lives_ok`.
  - Segunda cuota igual (domicilio, concepto, 2026, 1) → `'23505'`.
  - RLS habilitado en las 14 tablas: `relrowsecurity = true` en `pg_class` para cada una. No probar "sin filas visibles": la tarea 4 agrega políticas y esa aserción fallaría al correr toda la suite.

- [ ] **Step 2: Correr y ver que falla:** → FAIL (`relation "public.domicilios" does not exist`).

- [ ] **Step 3: Escribir la migración** con lo de Interfaces. Grants `select, insert, update, delete` a `authenticated`, `all` a `service_role`, y `usage, select` de las secuencias a ambos.

- [ ] **Step 4: Correr:** → PASS.

- [ ] **Step 5: Listo para commit.**

---

### Task 4: Políticas RLS de negocio

**Files:**
- Create: `supabase/migrations/<ts>_rls_negocio.sql`
- Create: `supabase/tests/database/040-rls-negocio.test.sql`

**Interfaces:**
- Consumes: matriz de permisos, `private.*`, `tests.*`.
- Produces: por cada una de las 14 tablas, cuatro políticas `to authenticated` llamadas `<tabla>_select`, `<tabla>_insert`, `<tabla>_update`, `<tabla>_delete`. Patrón (roles según la matriz):

```sql
create policy cuotas_update on public.cuotas for update to authenticated
  using ((select private.es_super_admin())
         or (fraccionamiento_id = (select private.fraccionamiento_actual())
             and (select private.tiene_rol('{administrador,tesorero}'))))
  with check ((select private.es_super_admin())
         or (fraccionamiento_id = (select private.fraccionamiento_actual())
             and (select private.tiene_rol('{administrador,tesorero}'))));
```

- [ ] **Step 1: Escribir la prueba.** Recorrer la matriz con un bloque por rol de A (más `super`, `inactivo.a` y `admin.c`). Para no escribir 200 aserciones a mano, la prueba puede iterar sobre una tabla de expectativas `(tabla, rol, puede_leer, puede_escribir)` definida en la propia prueba con `values`, usando `results_eq` contra `count(*)` y `lives_ok`/`throws_ok` o filas afectadas en un `update … set fraccionamiento_id = fraccionamiento_id`. Debe cubrir:
  - Cada rol de A con `L`: `count(*)` de cada tabla = 1 (solo la fila de A). Sin `L`: 0.
  - Cada rol de A sin `E`: `insert` → `'42501'`; `update` y `delete` → 0 filas.
  - Cada rol con `E`: `update` de la fila de A afecta 1 fila; de la fila de B, 0 filas; `insert` con `fraccionamiento_id` de B → `'42501'`.
  - `admin.a` hace `update domicilios set fraccionamiento_id = tests.fid('fracc-b')` sobre su fila → `'42501'` (Review Focus 4).
  - `admin.a` inserta un domicilio sin `fraccionamiento_id` → queda con el de A.
  - `super` lee 2 filas en cada tabla. Inserta un domicilio sin `fraccionamiento_id` → `'23502'`; con `fraccionamiento_id` de B → `lives_ok` (Review Focus 1).
  - Catálogos iniciales: `super` inserta en `conceptos_pago` (`'Cuota inicial'`, `tipo_pago_id = 1`, `fraccionamiento_id` de A), en `conceptos_descuento` y en `conceptos_recargo`. Después, como `admin.a`, el `update` de `importe` y `nombre` de esas filas afecta 1 fila cada uno. Como `tesorero.a`, el mismo `update` afecta 0 filas.
  - `inactivo.a` y `admin.c` leen 0 filas en todas las tablas.
  - Con `fracc-a` desactivado en la transacción, `admin.a` lee 0 filas en `domicilios` (Review Focus 2).

- [ ] **Step 2: Correr y ver que falla:** → FAIL (cuentas en 0 donde se esperaba 1).

- [ ] **Step 3: Escribir la migración** con las 56 políticas según la matriz.

- [ ] **Step 4: Correr:** → PASS.

- [ ] **Step 5: Listo para commit.**

---

### Task 5: Vistas

**Files:**
- Create: `supabase/migrations/<ts>_vistas.sql`
- Create: `supabase/tests/database/050-vistas.test.sql`

**Interfaces:**
- Consumes: tablas de las tareas 1 a 3.
- Produces: las 11 vistas del spec, todas `with (security_invoker = on)`, con la definición de la referencia salvo:
  - `users_info`: `select id, email, nombre as user_name, activo as is_active, created_at, rol, fraccionamiento_id from public.perfiles`.
  - `reporte_pagos_detalle`: join a `public.perfiles u` con `u.nombre as nombre_usuario`, `u.email as usuario`.

  Grants: `select` a `authenticated` y `service_role`.

- [ ] **Step 1: Escribir la prueba:**
  - `has_view` para las 11.
  - `results_eq` de `select reloptions from pg_class where relname = '<vista>'` contiene `security_invoker=on`, iterando las 11.
  - Como `admin.a`: `domicilios_info`, `cuotas_info` y `pagos_info` devuelven 1 fila, con la dirección `Calle A 1`.
  - Como `vigilancia.a`: `accesos_tarjeta_info` sin error, `pagos_info` vacía.
  - Como `admin.a`: `resumen_financiero_completo.total_ingresos` = 1000 (solo el movimiento de A).
  - Como `admin.a`: `users_info` devuelve los 5 perfiles de A.
  - Como `comite.a`: en cada vista que tiene `domicilio_id`, `is_empty` de las filas con el `domicilio_id` de B.

- [ ] **Step 2: Correr y ver que falla:** → FAIL (`relation "public.domicilios_info" does not exist`).

- [ ] **Step 3: Escribir la migración.**

- [ ] **Step 4: Correr:** → PASS.

- [ ] **Step 5: Listo para commit.**

---

### Task 6: Funciones de negocio, triggers y cron

**Files:**
- Create: `supabase/migrations/<ts>_funciones_negocio.sql`
- Create: `supabase/tests/database/060-funciones.test.sql`

**Interfaces:**
- Consumes: tablas y políticas de las tareas 3 y 4.
- Produces (todas `security invoker`, `set search_path = ''`):
  - `public.fn_residente_principal()` y su trigger `trg_residente_principal`: la misma lógica que la referencia.
  - `public.fn_actualizar_cuotas_concepto()` y su trigger `trg_actualizar_cuotas_concepto`: la misma lógica; el `update` filtra también por `fraccionamiento_id = new.fraccionamiento_id`.
  - `public.fn_pago_to_movimiento()` y su trigger `trg_pagos_to_movimientos`: inserta el movimiento con `fraccionamiento_id = new.fraccionamiento_id`.
  - `public.generar_cuotas(p_anio integer, p_mes integer) returns void`:
    - Si `not (select private.tiene_rol('{administrador,tesorero}'))`, lanza `raise exception 'No tienes permiso para generar cuotas' using errcode = '42501'`.
    - Inserta solo para `dc.fraccionamiento_id = private.fraccionamiento_actual()`, con ese `fraccionamiento_id`.
    - El resto, igual que la referencia.
    - `grant execute` a `authenticated`; `revoke` de `public, anon`.
  - `public.marcar_cuotas_vencidas() returns void`: la misma lógica que la referencia, para todos los fraccionamientos. `revoke execute … from public, anon, authenticated`.
  - `create extension if not exists pg_cron;` y `select cron.schedule('marcar-cuotas-vencidas', '0 6 * * *', 'select public.marcar_cuotas_vencidas()');`

- [ ] **Step 1: Escribir la prueba:**
  - Como `tesorero.a`: `insert` de un pago de 500 → existe 1 movimiento nuevo con `fraccionamiento_id` de A, `tipo_id = 1` y la misma `referencia`. Un pago de 0 no crea movimiento.
  - Como `admin.a`: primer residente de un domicilio nuevo queda `es_principal = true`; al insertar otro con `es_principal = true`, el primero pasa a false.
  - Como `admin.a`: cambiar `domicilio_concepto.concepto_id` actualiza importe y concepto de las cuotas pendientes de ese domicilio, y no toca las de B.
  - Como `tesorero.a`: `generar_cuotas(2026, 2)` crea exactamente 1 cuota (A) y 0 en B (verificar como postgres). Llamarla de nuevo no crea más (Review Focus 5).
  - Como `comite.a` y `vigilancia.a`: `generar_cuotas(2026, 3)` → `throws_ok(…, '42501', 'No tienes permiso para generar cuotas')`.
  - Como `admin.a`: `select public.marcar_cuotas_vencidas()` → `'42501'`.
  - Como postgres: con la cuota de 2026-01 de A y de B pendientes y sin pago, `marcar_cuotas_vencidas()` deja ambas en `estatus_id = 3`.
  - `isnt_empty($$select 1 from cron.job where jobname = 'marcar-cuotas-vencidas' and schedule = '0 6 * * *'$$)`.

- [ ] **Step 2: Correr y ver que falla:** → FAIL (`function public.generar_cuotas(integer, integer) does not exist`).

- [ ] **Step 3: Escribir la migración.**

- [ ] **Step 4: Correr:** → PASS.

- [ ] **Step 5: Listo para commit.**

---

### Task 7: Seed del super admin local y verificación final

**Files:**
- Create: `supabase/seed.sql`
- Modify: `README.md` (sección "Base de datos local")

**Interfaces:**
- Produces: usuario `superadmin@local.test`, contraseña `superadmin123`, con perfil `super_admin` y nombre `Super Admin`. Sin fraccionamientos.

- [ ] **Step 1: Escribir `supabase/seed.sql`.**
  - `insert into auth.users` con `id` fijo `00000000-0000-0000-0000-000000000001`, `instance_id '00000000-0000-0000-0000-000000000000'`, `aud` y `role` `'authenticated'`, `encrypted_password = extensions.crypt('superadmin123', extensions.gen_salt('bf'))`, `email_confirmed_at = now()`, `raw_app_meta_data '{"provider":"email","providers":["email"]}'` y `raw_user_meta_data '{}'`.
  - Los campos `confirmation_token`, `recovery_token`, `email_change_token_new` y `email_change` en `''`; sin eso, GoTrue falla al iniciar sesión.
  - `insert into auth.identities` (`provider 'email'`, `provider_id` igual al id del usuario, `identity_data` con `sub` y `email`).
  - `insert into public.perfiles`.

- [ ] **Step 1b: Prueba global de permisos** `supabase/tests/database/090-permisos.test.sql`:
  - `is_empty` de los privilegios de `anon` sobre cualquier tabla, vista o secuencia de `public` (consultando `aclexplode(relacl)` en `pg_class`).
  - `is_empty` de los privilegios de `anon` sobre cualquier función de `public` (`pg_proc.proacl` y `has_function_privilege('anon', oid, 'execute')`).
  - `is_empty` de privilegios `TRUNCATE`, `TRIGGER`, `REFERENCES` o `MAINTAIN` de `authenticated` en `public`.

- [ ] **Step 2: Verificar el inicio de sesión:**
```bash
supabase db reset
curl -s -X POST 'http://127.0.0.1:55321/auth/v1/token?grant_type=password' \
  -H "apikey: $(supabase status -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["PUBLISHABLE_KEY"])')" \
  -H 'Content-Type: application/json' -d '{"email":"superadmin@local.test","password":"superadmin123"}'
```
Expected: JSON con `access_token`.

- [ ] **Step 3: Verificación completa:**
  - `supabase db reset && supabase test db` → todas las pruebas PASS.
  - `supabase db advisors --local` → sin hallazgos de seguridad de nivel ERROR o WARN sobre objetos de `public` o `private`. Si hay alguno, corregirlo en la migración que lo introdujo y repetir.
  - `supabase migration list --local` → las 6 migraciones.

- [ ] **Step 4: Documentar en `README.md`.**
  - Arranque local: `supabase start`, puertos 553xx, `supabase db reset`, `supabase test db` y el usuario `superadmin@local.test` / `superadmin123`.
  - Aviso: la app no funciona contra este esquema hasta la fase 2.

- [ ] **Step 5: Listo para commit:** `supabase/seed.sql` y `README.md`.

---

## Resultado y notas para la fase 2 (2026-11-10)

Fase 1 terminada: 6 migraciones, `seed.sql`, 8 archivos pgTAP con 679 pruebas en verde y advisors sin hallazgos.

Cambios respecto al plan original, decididos durante la ejecución:
- Todos los miembros activos de un fraccionamiento leen los perfiles de su fraccionamiento (lo necesitan los reportes). Escribir perfiles sigue siendo solo del administrador.
- Las restricciones únicas de una columna (`domicilio_concepto`, `concepto_pago_acceso`, `descuento_cuota`, `recargo_cuota`, `cuotas`) incluyen `fraccionamiento_id`, para no revelar si existen filas de otro fraccionamiento.
- `authenticated` no tiene permisos sobre las secuencias de negocio; las funciones nuevas de `public` no son ejecutables por `PUBLIC` por defecto.
- `fn_residente_principal` corrige un error de la versión de Lago Amadeo, que dejaba dos residentes principales.
- Registro abierto desactivado (`[auth] enable_signup = false`). `[auth.email] enable_signup` debe seguir en `true`, porque en falso también bloquea el inicio de sesión con contraseña.

Pendientes para la fase 2:
1. La app usa `users`, `user_roles`, `roles` y las columnas `role_name`/`role_id` de `users_info`, que ya no existen. `users_info` ahora tiene `rol` (enum en minúsculas) y `fraccionamiento_id`. Afecta `src/lib/auth/current-user.ts`, `src/features/usuarios/*`, `src/features/reportes/queries.ts` y `ROLES` en `src/lib/constants.ts`.
2. Alta de usuarios con service role: al hacerla, quitar `insert` en `perfiles` a `authenticated` y limitar `update` a `(nombre, rol, activo)`, para que un administrador no pueda cambiar el `id` ni el `email` de un perfil.
3. `getTenantContext` debe leer el perfil directamente: un usuario de un fraccionamiento inactivo no ve la fila de `fraccionamientos` y `rol_actual()` devuelve null.
4. `generar_cuotas` rechaza al super admin y `service_role` no tiene EXECUTE en las funciones de negocio; si la consola lo necesita, agregar un parámetro de fraccionamiento o el permiso.
5. Usuarios con historial (pagos, movimientos, domicilios) no se pueden borrar: desactivarlos.
6. `perfiles.email` es copia del email de Auth; mantenerlo sincronizado.
7. En la nube: crear el primer super admin con un procedimiento documentado (el seed no corre en `db push`) y desactivar "Allow new users to sign up" dejando activo el proveedor de email.
8. Al quitar la marca de principal al residente principal, el domicilio queda sin principal (igual que hoy). Pendiente de decisión del usuario.
9. Nunca correr `supabase test db` contra el proyecto en la nube: el archivo `000-setup` deja un esquema `tests` persistente.
