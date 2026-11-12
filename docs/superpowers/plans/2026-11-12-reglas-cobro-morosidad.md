# Reglas de cobro y morosidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reglas de cobro configurables por fraccionamiento (generación automática, vencimiento, gracia, recargo automático, umbral de morosidad) y ajuste manual de acceso por domicilio.

**Architecture:** Toda la lógica de fechas y estatus vive en Postgres (helpers `private.*`, RPCs `public.*`, un proceso diario pg_cron que reemplaza `marcar-cuotas-vencidas`). La app solo edita reglas, llama RPCs y muestra estado. El permiso de access-core sale de `perfil_deseado`, que ahora considera el ajuste manual y el umbral.

**Tech Stack:** Next.js 16 (leer `node_modules/next/dist/docs/` antes de tocar rutas/acciones), Supabase (Postgres 17, RLS, pg_cron, pgTAP), Vitest, zod, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-12-reglas-cobro-morosidad-design.md`

## Global Constraints

- Modo sin commits: nunca `git add`, `git rm` ni `git commit`; el usuario hace los commits. Los pasos "Commit" se sustituyen por la instantánea del controlador.
- Nunca escribir en el proyecto de producción Lago Amadeo; todo contra el stack local (puertos 553xx; comandos `supabase` con `</dev/null`).
- Funciones security definer en `private` con `set search_path = ''`.
- Valores por omisión = comportamiento actual: sin fila en `reglas_cobro` ⇒ `dia_generacion` nulo, vence último día del mes, `dias_gracia` 0, `cuotas_para_moroso` 1, sin recargo.
- Rangos: `dia_generacion` 1–28 o nulo; `dia_vencimiento` 1–31 o nulo (nulo = último día; si el mes es más corto, último día); `dias_gracia` 0–60; `cuotas_para_moroso` 1–12.
- Si `dia_vencimiento` < `dia_generacion`, la cuota del mes M vence ese día del mes M+1.
- "Hoy" = `(now() at time zone 'America/Mexico_City')::date` en toda la lógica nueva y en las funciones modificadas.
- Estatus de cuota: 1 Pendiente, 3 Vencido (pagado lo marca el flujo de pagos, no se toca). "Sin pago" = ninguna fila en `pagos`.
- La consola del super admin nunca muestra estado de pago, morosidad ni ajuste manual.
- `forzar_acceso` solo rol administrador (no tesorero, no super admin). "Activar" solo si es moroso; "Desactivar" solo si está al corriente.
- Textos de UI en español.

## Review Focus

- Meses cortos: `dia_vencimiento` 31 en febrero ⇒ 28/29; con mes vencido (gen 20, venc 10) en diciembre ⇒ 10 de enero del año siguiente. (Task 1 tests)
- Proceso diario corrido dos veces el mismo día no duplica cuotas ni recargos. (Task 2 tests)
- Activar el recargo no lo aplica a cuotas que vencieron antes de `recargo_desde`. (Task 2 tests)
- Subir `dias_gracia` regresa a Pendiente cuotas que estaban Vencido y aún sin pago. (Task 2 tests)
- Pagar la cuota de un domicilio moroso con acceso forzado "activo" limpia el ajuste en el mismo momento. (Task 2 test sobre `recalcular_permisos_acceso`)

---

### Task 1: Esquema, fechas y generación

**Files:**
- Create: `supabase/migrations/20261113090000_reglas_cobro.sql`
- Create: `supabase/tests/database/075-reglas-cobro.test.sql`
- Modify: `src/features/cuotas/actions.ts` (`generarCuotaDomicilio` usa RPC)
- Modify: `src/lib/supabase/database.types.ts` (regenerar)
- Test: `src/features/cuotas/actions.test.ts`

**Interfaces:**
- Produces:
  - tabla `public.reglas_cobro(fraccionamiento_id bigint pk fk, dia_generacion smallint null, dia_vencimiento smallint null, dias_gracia smallint not null default 0, cuotas_para_moroso smallint not null default 1, concepto_recargo_id bigint null, recargo_desde date null, updated_at timestamptz, updated_by uuid)`; FK compuesta `(concepto_recargo_id, fraccionamiento_id)` → `conceptos_recargo(id, fraccionamiento_id)` `on delete set null (concepto_recargo_id)`; checks de rangos. Trigger: al cambiar `concepto_recargo_id` a no nulo, `recargo_desde := hoy`; a nulo, `recargo_desde := null`.
  - RLS: select para usuarios del fraccionamiento y super admin; insert/update para administrador del fraccionamiento y super admin; sin delete.
  - columnas en `domicilios`: `acceso_forzado text null check in ('activo','inactivo')`, `acceso_forzado_por uuid null`, `acceso_forzado_en timestamptz null` (solo escribibles vía RPC de Task 2: revocar update de esas columnas a `authenticated`).
  - `private.hoy() returns date`.
  - `private.reglas_de(p_fraccionamiento_id bigint)` returns record con valores por omisión aplicados.
  - `private.fecha_vencimiento(p_fraccionamiento_id bigint, p_anio int, p_mes int) returns date`.
  - `public.generar_cuotas(p_anio, p_mes)` usa `private.fecha_vencimiento`.
  - `public.generar_cuota_domicilio(p_domicilio_id bigint, p_anio int, p_mes int) returns void` (roles administrador/tesorero; errores: `P0001 'La cuota ya existe'`, `P0001 'El domicilio no tiene tipo de cuota'`).

- [ ] **Step 1: pgTAP failing tests** en `075-reglas-cobro.test.sql`: `fecha_vencimiento` sin reglas = último día (2026-02 ⇒ 2026-02-28); `dia_vencimiento` 31 en 2028-02 ⇒ 2028-02-29; gen 20/venc 10 en 2026-12 ⇒ 2027-01-10; gen 25/venc nulo ⇒ fin del mismo mes; checks rechazan `dia_generacion` 29 y `dias_gracia` 61 (23514); RLS: tesorero no puede actualizar reglas, administrador sí, otro fraccionamiento no ve la fila; borrar el concepto de recargo deja `concepto_recargo_id` y `recargo_desde` nulos; `generar_cuota_domicilio` duplicada lanza P0001; `authenticated` no puede hacer update directo de `acceso_forzado` (42501).
- [ ] **Step 2:** `supabase db reset </dev/null && supabase test db </dev/null` ⇒ fallan los nuevos.
- [ ] **Step 3:** escribir la migración.
- [ ] **Step 4:** tests pgTAP pasan (todos los archivos).
- [ ] **Step 5:** regenerar tipos (`supabase gen types typescript --local > src/lib/supabase/database.types.ts </dev/null`); cambiar `generarCuotaDomicilio` a `supabase.rpc('generar_cuota_domicilio', …)` mapeando los P0001 a `MSG_CUOTA_DUPLICADA` / `MSG_SIN_CONCEPTO`; actualizar su test (llama la RPC con `p_domicilio_id, p_anio, p_mes`; error de duplicado ⇒ `fail(MSG_CUOTA_DUPLICADA)`). `npx vitest run src/features/cuotas` pasa.

### Task 2: Morosidad, ajuste manual y proceso diario

**Files:**
- Modify: `supabase/migrations/20261113090000_reglas_cobro.sql` (misma migración, sección nueva)
- Modify: `supabase/tests/database/075-reglas-cobro.test.sql`, `070-medios-acceso.test.sql` si cambia el comportamiento esperado de `perfil_deseado`/`marcar_cuotas_vencidas`
- Modify: `supabase/scripts/demo-local.sql` si llama `marcar_cuotas_vencidas`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `private.es_moroso(p_domicilio_id bigint) returns boolean` (count estatus 3 ≥ `cuotas_para_moroso`).
  - `public.perfil_deseado` (mismo nombre/firma): `acceso_forzado='activo'` ⇒ perfil corriente; `'inactivo'` ⇒ perfil moroso; si no, según `es_moroso`.
  - `private.limpiar_accesos_forzados(p_fraccionamiento_id bigint default null) returns int`: borra el ajuste (y `_por`, `_en`) cuando `activo` y no moroso, o `inactivo` y moroso. `recalcular_permisos_acceso` lo llama al inicio (así pagos, guardado de reglas y cron lo aplican).
  - `public.forzar_acceso(p_domicilio_id bigint, p_valor text) returns void`: `p_valor` en ('activo','inactivo') o null (quitar). Solo administrador del fraccionamiento del domicilio (42501 si no). 'activo' con domicilio no moroso o 'inactivo' con moroso ⇒ `P0001 'El acceso ya está en ese estado'`. Registra `auth.uid()` y `now()`. Termina con `recalcular_permisos_acceso(fraccionamiento)`.
  - `public.procesar_reglas_cobro() returns void` (solo postgres/service_role; revocado a authenticated). Por cada fraccionamiento, en orden: (1) si `dia_generacion` no nulo y día de hoy ≥ `dia_generacion`, genera cuotas faltantes del mes en curso (misma regla de existencia que `generar_cuotas`, sin chequeo de rol: factorizar un `private.generar_cuotas_de(fid, anio, mes)` que use ambas); (2) inserta `recargo_cuota` para cuotas sin pago, estatus 1 o 3, `fecha_vencimiento < hoy`, `fecha_vencimiento >= recargo_desde`, sin recargo; (3) estatus := 3 si sin pago y `fecha_vencimiento + dias_gracia < hoy`, := 1 si estaba 3, sin pago y ya no cumple; (4) `recalcular_permisos_acceso()` (todos).
  - `public.marcar_cuotas_vencidas()` se elimina; job pg_cron `marcar-cuotas-vencidas` se desprograma (`cron.unschedule`) y se programa `procesar-reglas-cobro` `'0 6 * * *'`.
  - vista de cuotas (`20261110063329_vistas.sql`, la que expone `estatus_calculado`): agrega rama `'En gracia'` cuando no pagada, `fecha_vencimiento < hoy` y estatus_id = 1; 'Vencido' cuando estatus_id = 3. Recrear con `create or replace view` conservando columnas.

- [ ] **Step 1: pgTAP failing tests**: `es_moroso` con umbral 2 y una cuota vencida = false, con dos = true; `perfil_deseado` respeta 'activo'/'inactivo'; `forzar_acceso` como tesorero ⇒ 42501, 'activo' sobre domicilio al corriente ⇒ P0001, 'activo' sobre moroso graba `_por`/`_en` y encola `asignar` si hay instalación; tras registrar pago de la única cuota vencida, `recalcular_permisos_acceso` limpia el 'activo'; `procesar_reglas_cobro` ejecutado dos veces genera N cuotas y N recargos (no 2N) — usar `set local` de un hoy simulado: `private.hoy()` lee `current_setting('app.hoy', true)` si existe (solo para pruebas); recargo no se aplica a cuota con `fecha_vencimiento < recargo_desde`; subir `dias_gracia` regresa estatus 3→1; cuota pagada nunca cambia estatus; la vista muestra 'En gracia'; job `procesar-reglas-cobro` existe y `marcar-cuotas-vencidas` no.
- [ ] **Step 2:** correr pgTAP ⇒ fallan.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** todos los pgTAP pasan; regenerar tipos; `npx tsc --noEmit` limpio (quitar usos de `marcar_cuotas_vencidas` si los hay).

### Task 3: Reglas de cobro en la app (administrador y consola)

**Files:**
- Create: `src/features/reglas-cobro/{schemas.ts,queries.ts,actions.ts,mutaciones.ts,messages.ts}`, `src/features/reglas-cobro/components/reglas-cobro-form.tsx` + tests
- Modify: `src/app/(app)/configuracion/page.tsx` (sección "Reglas de cobro", solo administrador edita; tesorero ve solo lectura)
- Modify: consola: `src/features/fraccionamientos/tabs.ts`, `fraccionamiento-tabs.tsx` y la página del detalle del fraccionamiento en consola — nueva pestaña `cobro` con etiqueta "Reglas de cobro"

**Interfaces:**
- Consumes: tabla `reglas_cobro`, `recalcular_permisos_acceso(p_fraccionamiento_id)`, lista `conceptos_recargo` del fraccionamiento.
- Produces: `reglasCobroSchema` (zod; campos nullable según rangos de Global Constraints, enteros), `obtenerReglasCobro(fraccionamientoId: number | null): Promise<ReglasCobro>` (valores por omisión si no hay fila), `guardarReglasCobro(input)` (administrador, fraccionamiento propio) y `guardarReglasCobroConsola(fraccionamientoId, input)` (super admin), ambas sobre `guardarReglasCobroEn(fraccionamientoId: number | null, input)` en `mutaciones.ts` (mismo patrón que `src/features/controles/mutaciones.ts`): upsert y luego `recalcular_permisos_acceso`.
- Formulario: "Día de generación automática" (vacío = no generar), "Día de vencimiento" (vacío = último día del mes), "Días de gracia", "Cuotas vencidas para ser moroso", "Recargo automático" (select con "Ninguno" + conceptos con monto). Debajo, texto de ejemplo calculado de los valores: p. ej. "Las cuotas vencen el día 31; el recargo se aplica el día 1 y el acceso cambia a moroso el día 6." Con mes vencido indicar "del mes siguiente".

- [ ] **Step 1:** tests vitest: schema rechaza 29 en generación y 61 en gracia; acción de administrador con rol tesorero ⇒ fail de permisos; guardar llama upsert y `rpc('recalcular_permisos_acceso', { p_fraccionamiento_id })`; formulario muestra el texto de ejemplo para venc 31 / gracia 5; consola renderiza la pestaña sin datos de pagos.
- [ ] **Step 2:** fallan. **Step 3:** implementar. **Step 4:** `npx vitest run src/features/reglas-cobro src/features/fraccionamientos src/app` pasan.

### Task 4: Ajuste manual de acceso y estado "En gracia" en la UI

**Files:**
- Create: `src/features/domicilios/components/acceso-forzado.tsx` + test; acciones `forzarAcceso(domicilioId: number, valor: 'activo' | 'inactivo' | null)` en `src/features/domicilios/actions.ts`
- Modify: `src/app/(app)/domicilios/[id]/page.tsx` (bloque visible para administrador y tesorero; botones solo administrador; nunca en la consola)
- Modify: `src/components/status-badge.tsx` (+ test) para 'En gracia' (tono advertencia); `esEditable` en `src/features/cuotas/actions.ts` incluye 'En gracia'

**Interfaces:**
- Consumes: `public.forzar_acceso`, columnas `acceso_forzado*`, `private.es_moroso` expuesto en lo que lea la página (agregar `es_moroso` a la consulta del domicilio vía una RPC `public.estado_acceso_domicilio(p_domicilio_id) returns table(es_moroso boolean, acceso_forzado text, forzado_por_nombre text, forzado_en timestamptz)`, sin acceso para super admin) — crearla en la migración de Task 2 si no existe aún (añadir a esta tarea si el implementador de Task 2 no la creó).
- UI: si moroso y sin ajuste ⇒ botón "Activar acceso"; si al corriente y sin ajuste ⇒ "Desactivar acceso"; con ajuste ⇒ insignia "Acceso activado manualmente por {nombre} el {fecha}" (o "desactivado") y botón "Quitar ajuste". Cada acción con confirmación (AlertDialog) que explica que el ajuste se quita solo cuando cambie la situación del domicilio.

- [ ] **Step 1:** tests: tesorero ve la insignia pero no botones; administrador moroso ve "Activar acceso"; acción mapea P0001 a mensaje "El acceso ya está en ese estado"; status badge 'En gracia'.
- [ ] **Step 2–4:** fallan, implementar, pasan (`npx vitest run src/features/domicilios src/components src/app/(app)/domicilios`).

### Task 5: Cierre

**Files:** `supabase/scripts/demo-local.sql` (reglas de ejemplo para el fraccionamiento demo: gen 25, venc nulo, gracia 5, recargo con un concepto existente), `README.md` (sección reglas de cobro), `docs/integraciones/access-core-mapeo.md` (perfil_deseado ahora considera ajuste y umbral).

- [ ] **Step 1:** actualizar archivos.
- [ ] **Step 2:** verificación completa: `supabase db reset </dev/null`, `supabase test db </dev/null`, `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — todo limpio.

## Resultado y pendientes (2026-11-12)

Completo, sin commits. pgTAP 977, vitest 973, tsc/eslint/build limpios. Revisión final sin hallazgos críticos/importantes; ola de correcciones: código muerto, duplicado por concepto en `generar_cuota_domicilio`, trigger en `reglas_cobro` que actualiza estatus al guardar.
Decisiones: Configuración sigue siendo solo administrador (tesorero no ve reglas); `reglas_cobro` legible por cualquier usuario del fraccionamiento; con 0 días de gracia la cuota se muestra "En gracia" hasta el proceso de medianoche; la sección de reglas va como tarjeta arriba de las pestañas de catálogos.
