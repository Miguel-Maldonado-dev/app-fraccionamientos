# Residentes como usuarios (entrega 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Residentes con cuenta (usuario sintético `telefono@auth.internal`, varios domicilios por cuenta), aislados por RLS a sus domicilios, dados de alta por el personal desde la web, con límite por fraccionamiento y teléfono como medio de acceso.

**Architecture:** Tabla `cuentas_residente` + `residentes.user_id`; los residentes no tienen fila en `perfiles`, así las políticas del personal los rechazan por omisión; políticas nuevas de solo lectura basadas en `private.domicilios_del_residente()`. Altas y restablecimiento vía Server Actions que validan rol y luego usan service-role (patrón `src/features/usuarios/alta.ts`).

**Tech Stack:** Next.js 16 (leer `node_modules/next/dist/docs/` antes de tocar acciones/rutas), Supabase (RLS, Auth admin, pgTAP), Vitest, zod, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-13-residentes-app-movil-design.md` (esta entrega cubre §4 Modelo, Web (personal) salvo el constructor de botones, y las decisiones de cuentas; `app_botones`, `estado_app_domicilio`, `/api/app/*` y `aperturas_remotas` son la entrega 2).

## Global Constraints

- Modo sin commits: nunca `git add`, `git rm`, `git commit` ni otra escritura de git; el usuario hace los commits.
- Solo stack local (puertos 553xx; comandos `supabase` con `</dev/null`); nunca el proyecto de producción.
- Secretos solo en servidor, nunca `NEXT_PUBLIC_`. Service-role solo después de validar rol y fraccionamiento.
- Funciones security definer en `private` con `set search_path = ''`.
- Correo sintético: `<10 dígitos>@auth.internal`; teléfono normalizado quitando todo lo que no sea dígito; si quedan 12 dígitos que empiezan con `52`, se quita el `52`; cualquier otro largo ≠ 10 se rechaza con "El teléfono debe tener 10 dígitos".
- Una cuenta puede pertenecer a varios domicilios (de uno o varios fraccionamientos); único (domicilio_id, user_id).
- Si el teléfono ya tiene cuenta, se vincula sin contraseña nueva y la existente no cambia.
- `fraccionamientos.max_residentes_app smallint not null default 5`, rango 1–20; cuentan residentes con `user_id`; bajar el máximo no quita a nadie.
- Quitar al residente de su último domicilio: `cuentas_residente.activo=false`, ban en Auth (`ban_duration: '876000h'`) y cierre de sesiones; reactivar al volver a vincular (quitar ban).
- Un residente nunca ve datos de otros domicilios ni del fraccionamiento (pagos ajenos, residentes ajenos, reportes, movimientos, usuarios, configuración, instalación).
- Pantallas y permisos del personal no cambian. Textos de UI en español.

## Review Focus

- Un residente con sesión que consulta `domicilios`, `cuotas`, `pagos`, `residentes`, `movimientos`, `perfiles`, vistas e info de otros domicilios recibe 0 filas. (Task 1 pgTAP)
- El mismo teléfono capturado como "33 1234 5678", "+52 3312345678" y "3312345678" vincula a la misma cuenta. (Task 2 vitest)
- Alta cuando el domicilio ya llegó al máximo ⇒ error claro y no se crea cuenta en Auth. (Task 2 vitest)
- Si falla el insert de `cuentas_residente`/`residentes` tras crear el usuario en Auth, se borra el usuario de Auth. (Task 2 vitest)
- Un tesorero de otro fraccionamiento no puede dar acceso ni restablecer contraseñas de residentes ajenos. (Task 2 vitest + Task 1 pgTAP)

---

### Task 1: Base de datos — cuentas, aislamiento RLS y límite

**Files:**
- Create: `supabase/migrations/20261114090000_residentes_usuarios.sql`
- Create: `supabase/tests/database/080-residentes-usuarios.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerar)

**Interfaces — Produces:**
- `public.cuentas_residente(user_id uuid pk references auth.users on delete cascade, telefono text not null unique check (telefono ~ '^[0-9]{10}$'), activo boolean not null default true, created_at timestamptz default now())`. RLS: select propio (`user_id = auth.uid()`); select para administrador/tesorero si la cuenta tiene algún residente en su fraccionamiento; sin insert/update/delete para `authenticated` (solo service-role).
- `residentes.user_id uuid null references public.cuentas_residente(user_id)`; unique (domicilio_id, user_id).
- `fraccionamientos.max_residentes_app smallint not null default 5 check (between 1 and 20)`; update permitido al administrador de su fraccionamiento (revisar grants/políticas de `fraccionamientos` y añadir solo esa columna).
- `private.domicilios_del_residente() returns setof bigint` (security definer, stable): domicilios donde `residentes.user_id = auth.uid()`, cuenta activa y fraccionamiento activo.
- `private.es_residente_de(p_domicilio_id bigint) returns boolean`.
- Políticas nuevas `*_residente_select` (solo SELECT) en: `domicilios` (id in domicilios_del_residente), `cuotas`, `pagos`, `recargo_cuota`, `descuento_cuota`, `residentes` (mismo domicilio), `tarjetas_acceso`, `controles_acceso`, `pines_acceso`, `telefonos_acceso`, `domicilio_concepto`, `conceptos_pago` (solo los asignados a sus domicilios). Ninguna en `fraccionamientos`, `perfiles`, `movimientos`, `sincronizaciones_acceso`, `reglas_cobro`, catálogos de recargo/descuento salvo vía joins de las vistas.
- Revisar todas las vistas en `public` (listar con `pg_views`): deben ser `security_invoker = true` o no ser legibles por el residente; anotarlo en el reporte.
- `public.residentes_con_cuenta(p_domicilio_id bigint) returns int` (personal del fraccionamiento o el propio residente).

- [ ] **Step 1: pgTAP** con fixtures: fraccionamientos A y B; domicilios A1, A2, B1; usuario residente R vinculado a A1 y B1 (sin perfil); otro residente S en A2. Asserts: R ve exactamente A1 y B1 en `domicilios`; ve cuotas/pagos de A1 y B1 y 0 de A2; ve residentes de A1 y B1, no S; 0 filas en `perfiles`, `movimientos`, `fraccionamientos`, `reglas_cobro`, `sincronizaciones_acceso`; cada vista de `public` devuelve 0 filas de A2; R no puede insert/update/delete en `residentes`, `cuotas`, `pagos` (42501 o 0 filas); `authenticated` no puede insertar en `cuentas_residente`; cuenta inactiva ⇒ R ve 0 domicilios; fraccionamiento B inactivo ⇒ R solo ve A1; tesorero de B no ve la cuenta S; `max_residentes_app` 0 o 21 ⇒ 23514; administrador puede actualizar `max_residentes_app`, tesorero no; el personal sigue viendo todo su fraccionamiento (regresión).
- [ ] **Step 2:** `supabase db reset </dev/null && supabase test db </dev/null` ⇒ fallan los nuevos.
- [ ] **Step 3:** migración.
- [ ] **Step 4:** toda la suite pgTAP pasa; regenerar tipos; `npx tsc --noEmit` limpio.

### Task 2: Servicio de cuentas de residente

**Files:**
- Create: `src/features/residentes/telefono.ts` (+ test), `src/features/residentes/cuentas.ts` (+ test), `src/features/residentes/cuentas-actions.ts` (+ test)
- Modify: `src/features/residentes/schemas.ts`, `messages.ts`

**Interfaces:**
- Consumes: Task 1 tablas/columnas.
- Produces:
  - `normalizarTelefono(valor: string): string | null` y `correoSintetico(telefono: string): string` (`${telefono}@auth.internal`).
  - `cuentas.ts` (no `'use server'`, recibe cliente service-role):
    - `obtenerOCrearCuenta(admin, { telefono, password? }): Promise<{ ok: true; userId: string; creada: boolean } | { ok: false; motivo: 'password_requerida' | 'password_invalida' | 'error' }>` — busca en `cuentas_residente` por teléfono; si existe la reactiva (activo=true, quitar ban `ban_duration: 'none'`); si no, `auth.admin.createUser({ email, password, email_confirm: true })` + insert en `cuentas_residente` (si falla el insert, `deleteUser`).
    - `desactivarSiSinDomicilios(admin, userId): Promise<void>` — si no le quedan residentes con ese `user_id`: activo=false, `updateUserById(userId, { ban_duration: '876000h' })`, `auth.admin.signOut` de sus sesiones (si la API lo permite por usuario; si no, el ban basta y se anota).
    - `restablecerPassword(admin, userId, password): Promise<ActionResult>`.
  - `cuentas-actions.ts` (`'use server'`, roles administrador/tesorero, el domicilio debe ser de su fraccionamiento — verificar con el cliente del usuario antes de usar service-role):
    - `darAccesoApp(residenteId: number, input: { telefono: string; password?: string }): Promise<ActionResult>` — valida teléfono, verifica `residentes_con_cuenta < max_residentes_app` (mensaje "Este domicilio ya tiene el máximo de N residentes con acceso a la app"), obtiene/crea cuenta, actualiza `residentes.user_id` y `residentes.telefono` normalizado; si el teléfono ya está vinculado a otro residente del mismo domicilio ⇒ "Ese teléfono ya tiene acceso en este domicilio". Luego Task 3 hook de teléfono.
    - `quitarAccesoApp(residenteId: number): Promise<ActionResult>` — `user_id = null`, luego `desactivarSiSinDomicilios`.
    - `restablecerPasswordResidente(residenteId: number, password: string): Promise<ActionResult>`.
  - `crearResidente` existente acepta opcional `{ telefono, password, darAcceso: boolean }`: si `darAcceso`, crea el residente y llama a la lógica de `darAccesoApp`; si la cuenta falla, el residente se queda sin acceso y se informa (no se borra).
  - Contraseña: mínimo 8 caracteres ("La contraseña debe tener al menos 8 caracteres").
- [ ] **Step 1:** vitest con mocks del cliente: normalización (3 formatos ⇒ "3312345678"; 9 dígitos ⇒ null; "523312345678" ⇒ "3312345678"); cuenta existente ⇒ no llama `createUser` y no exige password; nueva sin password ⇒ `password_requerida`; fallo de insert ⇒ `deleteUser` llamado; máximo alcanzado ⇒ fail y sin `createUser`; tesorero de otro fraccionamiento (el residente no es visible con su cliente) ⇒ fail `MSG_NO_ENCONTRADO` sin tocar service-role; quitar el último domicilio ⇒ ban; quitar con otro domicilio restante ⇒ sin ban.
- [ ] **Step 2–4:** fallan, implementar, `npx vitest run src/features/residentes` pasa; tsc/eslint limpios.

### Task 3: Teléfono del residente como medio de acceso

**Files:** Modify `src/features/residentes/cuentas-actions.ts` (o un `telefono-acceso.ts` nuevo) + tests; revisar `src/features/accesos` para mostrar teléfonos.

**Interfaces:**
- `sincronizarTelefonoAcceso(supabase, { domicilioId, telefonoAnterior: string | null, telefonoNuevo: string | null }): Promise<void>` — si el tipo de cuota del domicilio incluye el medio `telefono` (ver `concepto_pago_acceso.medios`): inserta `telefonos_acceso(domicilio_id, telefono)` si no existe; si cambió o se quitó el acceso, borra el anterior. Sin medio habilitado no hace nada. No encola sincronización (access-core no tiene API de teléfonos).
- Se llama en `darAccesoApp` y `quitarAccesoApp`.
- [ ] **Step 1:** tests: con medio habilitado inserta una vez (idempotente); sin medio no inserta; quitar acceso borra el teléfono; teléfono ya registrado manualmente no se duplica.
- [ ] **Step 2–4:** fallan, implementar, pasan.

### Task 4: UI del personal

**Files:**
- Modify: `src/features/residentes/components/residente-dialog.tsx`, `residentes-table.tsx`, `residente-actions.tsx`, `acciones.ts` (+ tests)
- Create: `src/features/residentes/components/acceso-app-dialog.tsx` (+ test)
- Modify: página/sección de Configuración del fraccionamiento: campo "Residentes con acceso a la app por domicilio" (en la pestaña "Reglas de cobro" no; crear sección dentro de una pestaña nueva `app` con etiqueta "App de residentes" en `src/features/catalogos/catalogos.ts` → `TABS_CONFIGURACION`, siguiendo el patrón de `reglas`) con acción `guardarMaxResidentesApp(valor: number)` (solo administrador).

**UI:**
- Alta de residente: casilla "Dar acceso a la app" que muestra Teléfono y Contraseña (si el teléfono ya tiene cuenta, el servidor ignora la contraseña y el toast dice "Se vinculó la cuenta existente").
- Tabla de residentes: columna/insignia "App" (Con acceso / Sin acceso) y encabezado "Acceso a la app: 3 de 5".
- Menú de acciones del residente: "Dar acceso a la app" (abre `acceso-app-dialog`), "Restablecer contraseña", "Quitar acceso a la app" (con confirmación). Visibles para administrador y tesorero.
- [ ] **Step 1:** tests: casilla muestra campos; contador "3 de 5"; acciones según estado; tab "App de residentes" en Configuración; validación 1–20.
- [ ] **Step 2–4:** fallan, implementar, pasan.

### Task 5: Cierre

- [ ] `supabase/scripts/demo-local.sql`: dar cuenta a un residente demo (teléfono `3300000001`, contraseña `residente123`, documentado como solo local) vinculado a dos domicilios demo; `max_residentes_app` 5.
- [ ] `README.md`: sección "Residentes y app móvil" (formato de usuario, quién da de alta, límite, aislamiento).
- [ ] Verificación completa: `supabase db reset </dev/null`, `supabase test db </dev/null`, demo-local, `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`, `npm run build`.

## Resultado y pendientes (2026-11-13)

Completo, sin commits. pgTAP 1024, vitest 1039, tsc/eslint/build limpios; prueba manual de RLS con el residente demo (solo ve sus 2 domicilios). Revisión final: 3 importantes corregidos (restablecer contraseña de cuenta usada en otro fraccionamiento bloqueado; borrar residente con cuenta limpia teléfono y desactiva cuenta; teléfono no editable con acceso a la app).
Decisiones: alta de residentes sigue solo para administrador (tesorero da/quita acceso y restablece); sin cierre de sesión por usuario (el ban impide renovar, el token vigente dura ~1 h); formulario de alta limitado a 10 dígitos; prefijo 521 también se normaliza.
Siguiente: entrega 2 (constructor de botones, estado_app_domicilio, /api/app/*, aperturas_remotas, nombre/marca del fraccionamiento para el residente).
