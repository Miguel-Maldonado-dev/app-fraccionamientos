# Medios de acceso e integración con access-core-cloud: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cinco medios de acceso habilitables por fraccionamiento y por tipo de cuota, con domicilios, tarjetas, controles, PIN y permisos reflejados en la instalación de access-core-cloud a través de una cola con reintentos.

**Architecture:**
- Una migración agrega el enum `medio_acceso`, las tablas `fraccionamiento_medios`, `fraccionamiento_botones`, `controles_acceso`, `pines_acceso` y `sincronizaciones_acceso`, las columnas de ids externos, las funciones `perfil_deseado` y `recalcular_permisos_acceso`, y elimina las vistas y la función de los reportes de acceso.
- `src/lib/access-core/` es un cliente `server-only` de la API (fetch, `Idempotency-Key`, `AccessCoreError`).
- `src/features/sincronizacion/` tiene la cola (`encolar`), el trabajador (`procesarSincronizaciones`, con `createAdminClient()`) y la pantalla de sincronización. Las mutaciones existentes de domicilios y tarjetas encolan tareas; `after()` de `next/server` dispara el trabajador tras cada acción y una ruta protegida lo dispara desde el cron del hosting.
- La consola configura instalación, medios y botones; Configuración del fraccionamiento elige medios y permisos por tipo de cuota; el detalle del domicilio muestra una tarjeta por medio con su estado de sincronización.

**Tech Stack:** Next.js 16.3 (`after`, Route Handlers), React 19.2, Supabase (RLS, pgTAP, pg_cron), Zod 4, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-medios-acceso-access-core-design.md` (aprobado 2026-11-11).

## Global Constraints

- **No hacer commits.** El usuario hace todos los commits. Nunca `git add`/`git rm`: borrar archivos con `rm`.
- **Next.js 16:** leer `node_modules/next/dist/docs/` antes de escribir código de Next (AGENTS.md); en particular `01-app/03-api-reference/04-functions/after.md` y los Route Handlers. No levantar el servidor.
- **Comprobaciones al cerrar cada tarea:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Con cambios de base, además `supabase db reset </dev/null && supabase test db </dev/null` y recargar la demo con `docker exec -i supabase_db_app-fraccionamientos psql -U postgres -v ON_ERROR_STOP=1 < supabase/scripts/demo-local.sql`. Todos los comandos `supabase` llevan `</dev/null`.
- **No modificar migraciones existentes:** los cambios de esquema van en una migración nueva con pruebas pgTAP; los tipos se regeneran con `supabase gen types typescript --local > src/lib/supabase/database.types.ts </dev/null`. Toda tabla nueva revoca `all` a `anon, authenticated` y concede explícitamente (patrón de `20261110062041_tablas_negocio.sql`).
- **Llave y secretos:** `ACCESS_CORE_API_KEY` y `CRON_SECRET` se leen solo en código `server-only`, nunca con prefijo `NEXT_PUBLIC_`, y nunca al cargar un módulo (lectura perezosa, como `createAdminClient`). El PIN nunca viaja en `sincronizaciones_acceso.carga`.
- **Service role:** solo el trabajador (`procesarSincronizaciones`), `reintentarTarea` (porque `authenticated` no actualiza la cola) y el alta de usuarios existente usan `createAdminClient()`, siempre después de comprobar con el cliente de sesión que la fila pertenece al fraccionamiento del usuario.
- **Autorización:** páginas de `/admin` con `requireSuperAdminPage()`, acciones de consola con `runSuperAdminAction`; acciones del fraccionamiento con `runAction(ROLES_GESTION | ADMIN, …)` como las vecinas.
- **Sin red en las pruebas:** `fetch` se simula con `vi.fn()`/`vi.stubGlobal`; el cliente de la API se simula en las pruebas de acciones y del trabajador.
- **Comportamiento intacto:** teléfonos se capturan igual que hoy y no se sincronizan; los componentes del fraccionamiento sin las props nuevas se comportan igual.
- **Textos en español**, sentence case, componentes y tokens WEADMI existentes. TDD.
- **Textos fijos del spec** (copiar tal cual): "No se pudo consultar access-core", "access-core no está configurado", "El super admin aún no habilita medios de acceso para este fraccionamiento", "Asigna un tipo de cuota para habilitar los medios de acceso", "El super admin debe configurar las salidas de los botones", "Se sincronizará cuando access-core lo soporte", "El domicilio aún no está sincronizado", "Pide al super admin vincular la instalación de access-core", "Este fraccionamiento ya tiene domicilios sincronizados con su instalación", "Próximamente".

## Review Focus

1. **access-core responde 429 a mitad de una corrida.** El trabajador debe detenerse, dejar las tareas restantes `pendiente` con `proximo_intento_at` según `Retry-After`, y no contar intento a las que no tocó. Prueba en la tarea 4.
2. **Dos disparos simultáneos del trabajador para el mismo fraccionamiento** (acción + cron). Solo uno procesa; el otro espera el bloqueo y no encuentra nada. Prueba pgTAP del bloqueo en la tarea 1 y prueba del trabajador en la tarea 4.
3. **Un administrador intenta leer `pines_acceso` siendo comité o vigilancia**, o leer la cola de otro fraccionamiento. 0 filas. Tarea 1.
4. **Cambio de tipo de cuota que quita un medio con registros.** El diálogo avisa cuántas tarjetas y controles se ocultarán; tras guardar, los registros siguen en la base, no se muestran, y hay tareas `reconciliar` y `asignar`. Tarea 7.
5. **La API devuelve 409 al crear una tarjeta repetida.** La tarea pasa a `error` sin reintentos, la tarjeta local sigue existiendo con estado "Error" y el resto del domicilio sigue sincronizando. Tarea 4 (trabajador) y tarea 7 (badge).

## Notas de alcance

- La app no tiene acciones para borrar un domicilio ni para eliminar un pago; las ramas "borrar domicilio" y "eliminar pago" del spec (§4.3) quedan sin disparador y no se implementan en el trabajador. `operacion = 'borrar'` solo existe para tarjetas y controles.
- Las pruebas pgTAP de `reporte_accesos_admin` (en `065`) y de `accesos_*_info` (en `050`) se eliminan con los objetos.

---

### Task 1: Migración, pgTAP y adaptación de lo que leía las columnas viejas

**Files:**
- Create: `supabase/migrations/20261112090000_medios_acceso.sql`
- Create: `supabase/tests/database/070-medios-acceso.test.sql`
- Modify: `supabase/tests/database/040-rls-negocio.test.sql` (matriz y `super_permisos`), `050-vistas.test.sql` (sin `accesos_*_info`; `domicilios_info.medios`), `065-super-admin.test.sql` (sin `reporte_accesos_admin`), `supabase/scripts/demo-local.sql:64-69`
- Modify: `src/lib/supabase/database.types.ts` (regenerado), `src/lib/constants.ts`
- Modify: `src/features/catalogos/{catalogos,schemas,queries,actions}.ts`, `src/features/catalogos/components/tipo-cuota-dialog.tsx`, `tipos-cuota-section.tsx` y sus pruebas
- Modify: `src/features/accesos/components/accesos-section.tsx` (`domicilio.medios`)
- Delete: `src/features/fraccionamientos/accesos-admin.ts` (+ test), `src/features/reportes/components/{acceso-peatonal-tab,acceso-vehicular-tab,accesos-tarjeta-tabla,accesos-telefono-tabla,acceso-tabs.test,accesos-tablas.test}.tsx`, sus queries en `src/features/reportes/queries.ts`
- Modify: `src/app/(app)/reportes/page.tsx` y `src/features/reportes/components/reportes-tabs.tsx` (solo "Pagos por usuario"), `src/app/admin/fraccionamientos/[id]/page.tsx` (la pestaña `accesos` queda con un `EmptyState` "Próximamente" hasta la tarea 5)

**Interfaces:**
- Produces (SQL): enum `public.medio_acceso`; tablas `fraccionamiento_medios(fraccionamiento_id, medio)`, `fraccionamiento_botones(fraccionamiento_id, boton, panel_id, panel_codigo, salida, salida_alias)`, `controles_acceso(id, created_at, fraccionamiento_id, domicilio_id, control_id, descripcion, botones)`, `pines_acceso(domicilio_id, fraccionamiento_id, pin, actualizado_at)`, `sincronizaciones_acceso(id uuid, fraccionamiento_id, domicilio_id, entidad, entidad_id, operacion, carga, estado, intentos, ultimo_error, proximo_intento_at, created_at, updated_at)`; columnas `fraccionamientos.instalacion_nombre`, `domicilios.titular_id`, `domicilios.perfil_asignado_id`, `tarjetas_acceso.tarjeta_id`, `tarjetas_acceso.descripcion`, `concepto_pago_acceso.{medios, perfil_corriente_id, perfil_corriente_nombre, perfil_moroso_id, perfil_moroso_nombre}`; funciones `public.perfil_deseado(p_domicilio_id bigint) returns uuid`, `public.recalcular_permisos_acceso(p_fraccionamiento_id bigint default null) returns int` (tareas insertadas), tabla `sincronizacion_leases(fraccionamiento_id pk, token uuid, hasta timestamptz)` con `public.adquirir_sincronizacion(p_fraccionamiento_id bigint, p_token uuid, p_segundos int default 300) returns boolean` y `public.liberar_sincronizacion(p_fraccionamiento_id bigint, p_token uuid)`, solo para `service_role` (ajuste durante la ejecución: el advisory lock se liberaba al terminar cada llamada RPC); `domicilios_info.medios medio_acceso[]`.
- Produces (TS): `MEDIOS_ACCESO: readonly MedioAcceso[]` (orden `tarjeta, control, pin, telefono, qr`), `MEDIO_LABEL: Record<MedioAcceso, string>` ("Tarjeta", "Control RF", "PIN", "Teléfono", "Código QR"), `MEDIOS_SINCRONIZABLES = ['tarjeta','control','pin']`, `MEDIOS_HABILITABLES = ['tarjeta','control','pin','telefono']`, `LIMITES.CONTROLES = 2`; `TipoCuota = ElementoCatalogo & { medios: MedioAcceso[]; perfilCorrienteId: string | null; perfilCorrienteNombre: string | null; perfilMorosoId: string | null; perfilMorosoNombre: string | null }`; `tipoCuotaSchema` con `medios: z.array(z.enum(MEDIOS_ACCESO))`, `perfilCorrienteId`, `perfilMorosoId` (uuid o `''`→null) y los nombres opcionales.

- [ ] **Step 1: Escribir `070-medios-acceso.test.sql`** (usa `tests.crear_escenario()`, `crear_datos_negocio()`, `probar()`), con:
  - `fraccionamiento_medios`: el super admin inserta `('fracc-a','tarjeta')`; `admin.a` recibe 42501 al insertar; comité de A la lee (1 fila); `admin.b` lee 0.
  - Trigger de `concepto_pago_acceso`: `update … set medios = '{control}'` en A sin `control` habilitado → `23514`; con `control` habilitado → 1 fila.
  - Trigger de `fraccionamiento_medios`: borrar `tarjeta` de A mientras un concepto lo usa → `23503`; tras quitarlo del concepto → se borra.
  - `pines_acceso`: `admin.a` inserta un PIN `'1234'`; `tesorero.a` lo lee (1); `comite.a` y `vigilancia.a` leen 0; `admin.b` lee 0; `pin '12'` → `23514`.
  - `controles_acceso`: `admin.a` inserta `botones = '[{"boton":0,"rf_code":5,"boton_id":null}]'` → ok; `'[]'` → `23514`; `boton: 4` → `23514`.
  - `sincronizaciones_acceso`: `admin.a` inserta una tarea `pendiente`; su `update … set estado='ok'` afecta 0 filas; `vigilancia.a` la lee (1); `admin.b` lee 0; `estado = 'x'` → `23514`.
  - `perfil_deseado`: con `perfil_corriente_id = 'aaaaaaaa-…-0001'` y `perfil_moroso_id = '…-0002'` en el concepto de A: el domicilio de A sin cuotas vencidas → `…0001`; con una cuota `estatus_id = 3` → `…0002`; concepto sin permisos → nulo.
  - `recalcular_permisos_acceso(fid A)` como `admin.a`: domicilio con `titular_id` no nulo y `perfil_asignado_id` distinto → devuelve 1 e inserta 1 tarea `asignar`; segunda llamada → 0 (ya hay pendiente); como `admin.b` con fid A → 42501; sin `titular_id` → 0.
  - Lease: `service_role` adquiere (true); un segundo token recibe false mientras el lease es válido y true cuando expiró; `liberar` con token ajeno no borra; `authenticated` → 42501.
  - `domicilios_info.medios` del domicilio de A = `'{tarjeta,telefono}'` tras la migración de datos (los datos de `crear_datos_negocio` tienen ambos accesos en true; si no, ajustarlo ahí).
  - La función `reporte_accesos_admin` y las vistas `accesos_telefono_info` y `accesos_tarjeta_info` no existen (`hasnt_function`, `hasnt_view`).
  - El job `marcar-cuotas-vencidas` llama a `recalcular_permisos_acceso()` (`cron.job.command` contiene el nombre).
- [ ] **Step 2: Correr** `supabase test db </dev/null` → el archivo nuevo FALLA.
- [ ] **Step 3: Escribir la migración** según el spec §2, en este orden: enum; `fraccionamiento_medios`; `fraccionamiento_botones`; `alter` de `fraccionamientos`, `domicilios`, `tarjetas_acceso` (`check (numero ~ '^\d+$' and numero::numeric <= 4294967295)`); `concepto_pago_acceso` (agregar columnas, migrar datos a `medios`, poblar `fraccionamiento_medios`, `drop column acceso_telefono, acceso_tarjeta` con `cascade` de las vistas que las usan, recrear `domicilios_info` con `security_invoker`, grants como en `20261110063329_vistas.sql`); `controles_acceso`; `pines_acceso`; `sincronizaciones_acceso` (índice `(fraccionamiento_id, estado, proximo_intento_at)`); triggers; funciones; `drop function public.reporte_accesos_admin`; políticas (tenant: lectores `{administrador,tesorero,comite,vigilancia}` y escritores `{administrador}` para `controles_acceso`; `pines_acceso` lectores y escritores `{administrador,tesorero}`; `fraccionamiento_medios` y `fraccionamiento_botones` lectores todos y escritores ninguno; `sincronizaciones_acceso` lectores todos, insert `{administrador,tesorero}`; super admin: completo en `fraccionamiento_medios`, `fraccionamiento_botones`, `controles_acceso`, `pines_acceso`; select+insert en `sincronizaciones_acceso`); `marcar_cuotas_vencidas` recreada para llamar a `recalcular_permisos_acceso()` al final; grants y revokes explícitos.
- [ ] **Step 4: Actualizar `040`** (matriz: `controles_acceso`, `pines_acceso`, `fraccionamiento_medios`, `fraccionamiento_botones`, `sincronizaciones_acceso`; `super_permisos`; recalcular el `plan`), `050`, `065` y la demo (`medios '{tarjeta,telefono}'` más las filas de `fraccionamiento_medios`).
- [ ] **Step 5: Correr** `supabase db reset </dev/null && supabase test db </dev/null` → todo PASS. Regenerar tipos.
- [ ] **Step 6: Adaptar la app** a los tipos nuevos con sus pruebas: `constants.ts` (interfaces de arriba); `TipoCuota` y `listTiposCuota` (select `concepto_pago_acceso(medios, perfil_corriente_id, …)`, sin fila → `medios: []`); `tipoCuotaSchema`; `guardarTipoCuotaEn` escribe las cinco columnas; `TipoCuotaDialog` muestra una casilla por `MEDIOS_HABILITABLES` (etiquetas de `MEDIO_LABEL`; el filtrado por fraccionamiento y los permisos llegan en la tarea 6); `tipos-cuota-section` muestra los medios como badges; `AccesosSection` usa `domicilio.medios.includes('telefono')` / `'tarjeta'`.
- [ ] **Step 7: Quitar los reportes de acceso** (archivos de arriba), dejar `/reportes` solo con "Pagos por usuario" y la pestaña `accesos` de la consola con `EmptyState` "Próximamente".
- [ ] **Step 8: Verificación final:** los cuatro comandos de npm → verde; `grep -rn "acceso_telefono\|acceso_tarjeta\|accesos_telefono_info\|reporte_accesos_admin" src supabase/tests` → vacío.
- [ ] **Step 9: Listo para commit.**

---

### Task 2: Cliente de la API de access-core

**Files:**
- Create: `src/lib/access-core/{config,errores,http,instalaciones,perfiles,titulares,tarjetas,controles,index}.ts` y `src/lib/access-core/http.test.ts`, `instalaciones.test.ts`, `titulares.test.ts`, `controles.test.ts`
- Modify: `.env.example` (`ACCESS_CORE_API_URL`, `ACCESS_CORE_API_KEY`, `CRON_SECRET`, con el comentario "Solo servidor")
- Modify: `vitest` mocks: las pruebas hacen `vi.mock('server-only', () => ({}))` como `src/lib/supabase/admin.test.ts`

**Interfaces:**
- Produces:
  - `errores.ts`: `class AccessCoreError extends Error { status: number; code: string; retryAfter?: number; get reintentable(): boolean }` (reintentable: `status === 0 | 429 | 500 | 502`); `class AccessCoreNoConfigurado extends Error`.
  - `http.ts`: `llamar<T>(metodo: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE', ruta: string, opciones?: { cuerpo?: unknown; idempotencyKey?: string }): Promise<T>`: `Authorization: Bearer <key>`, `Idempotency-Key` si viene, `AbortSignal.timeout(10_000)`, error de red → `AccessCoreError` con `status 0`, respuesta no ok → `AccessCoreError` con `{code, message}` del cuerpo y `Retry-After` en segundos; `204`/sin cuerpo → `undefined`.
  - `instalaciones.ts`: `listarInstalaciones(): Promise<Instalacion[]>`, `obtenerInstalacion(id)`, `listarPaneles(instalacionId): Promise<Panel[]>`, `listarSalidas(instalacionId): Promise<Salida[]>`.
  - `perfiles.ts`: `listarPerfiles(instalacionId): Promise<Perfil[]>` (`{id, name, holder_ids}`), `asignarTitulares(instalacionId, perfilId, holderIds: string[], idempotencyKey)`.
  - `titulares.ts`: `crearTitular(instalacionId, cuerpo: TitularCrear, idempotencyKey): Promise<{ id: string }>`, `editarTitular(…)`, `borrarTitular(…)`, `fijarPin(instalacionId, titularId, pin: string): Promise<void>`, `generarPin(instalacionId, titularId): Promise<string>`, `quitarPin(instalacionId, titularId)`.
  - `tarjetas.ts`: `crearTarjeta(instalacionId, { card_code, holder_id, description }, key): Promise<{ id: string }>`, `editarTarjeta(instalacionId, id, { description }, key)`, `borrarTarjeta(instalacionId, id, key)`.
  - `controles.ts`: `crearControl(instalacionId, cuerpo: ControlCuerpo, key): Promise<Control>`, `reemplazarControl(instalacionId, id, cuerpo, key): Promise<Control>`, `borrarControl(instalacionId, id, key)`.
  - Los tipos (`Instalacion`, `Panel`, `Salida`, `Perfil`, `TitularCrear`, `ControlCuerpo`, `Control`, …) se escriben a mano a partir de `docs/integraciones/access-core-openapi.json`, solo con los campos que la app usa. Las respuestas `{data, revision}` se desenvuelven en `http.ts`.

- [ ] **Step 1: Pruebas** (`fetch` con `vi.stubGlobal`):
  - `llamar` manda `Authorization: Bearer acc_x`, `Content-Type: application/json` y `Idempotency-Key: k1` cuando se pasa; construye `${url}/installations/abc/holders`.
  - Sin `ACCESS_CORE_API_KEY` lanza `AccessCoreNoConfigurado` sin llamar a `fetch`.
  - `429` con `Retry-After: 7` → `AccessCoreError { status: 429, code: 'rate_limited', retryAfter: 7, reintentable: true }`; `409` → `reintentable: false`; `fetch` que rechaza → `status: 0`, reintentable.
  - `{data: {...}, revision: 3}` devuelve solo `data`.
  - `generarPin` manda `{ generate: true }` sin `Idempotency-Key` y devuelve `data.pin`; `fijarPin` manda `{ pin: '1234' }`.
  - `crearControl` manda `buttons[].outputs`.
- [ ] **Step 2: Correr** `npx vitest run src/lib/access-core` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS; `tsc`, `lint`.
- [ ] **Step 5: Listo para commit.**

---

### Task 3: Cola: encolar, estado y recálculo de permisos

**Files:**
- Create: `src/features/sincronizacion/{tipos,cola,queries}.ts`, `cola.test.ts`, `queries.test.ts`

**Interfaces:**
- Consumes: tabla `sincronizaciones_acceso` y `recalcular_permisos_acceso` (tarea 1).
- Produces:
  - `tipos.ts`: `type Entidad = 'domicilio'|'tarjeta'|'control'|'pin'`; `type Operacion = 'crear'|'actualizar'|'borrar'|'asignar'|'reconciliar'|'fijar'|'quitar'`; `type EstadoSync = 'pendiente'|'ok'|'error'`; `type TareaNueva = { fraccionamientoId: number; domicilioId: number | null; entidad: Entidad; entidadId: number | null; operacion: Operacion; carga?: Record<string, unknown> }`; `type Tarea = Tables<'sincronizaciones_acceso'>`.
  - `cola.ts` (no es `'use server'`): `encolar(supabase, tareas: TareaNueva[]): Promise<void>` (un solo `insert`; con arreglo vacío no llama); `encolarSiHayInstalacion(supabase, fraccionamientoId: number | null, tareas: (fid: number) => TareaNueva[]): Promise<boolean>` — resuelve el fraccionamiento (`fraccionamientoId ?? getTenantContext().fraccionamiento.id`), lee `fraccionamientos.instalacion_id`; sin instalación devuelve `false` sin insertar; `recalcularPermisos(supabase, fraccionamientoId: number): Promise<number>` (rpc).
  - `queries.ts`: `type EstadoEntidad = { estado: EstadoSync; error: string | null }`; `estadoDeEntidades(supabase, fraccionamientoId: number | null, entidad: Entidad, ids: number[]): Promise<Map<number, EstadoEntidad>>` (última tarea por `entidad_id`); `estadoDomicilio(supabase, …, domicilioId): Promise<EstadoEntidad | null>`; `listTareasAbiertas(supabase, fraccionamientoId: number | null): Promise<(Tarea & { direccion: string | null })[]>` (no `ok`, con la dirección del domicilio); `resumenSincronizacion(supabase, fraccionamientoId: number | null): Promise<{ pendientes: number; errores: number; ultimaOk: string | null }>`.

- [ ] **Step 1: Pruebas** con un cliente Supabase simulado (patrón de `src/features/fraccionamientos/metricas.test.ts`): `encolar` inserta filas en snake_case con `carga` `{}` por defecto; `encolarSiHayInstalacion` devuelve `false` y no inserta sin `instalacion_id`; `estadoDeEntidades` se queda con la tarea más reciente por id; `resumenSincronizacion` cuenta por estado.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Listo para commit.**

---

### Task 4: Trabajador, disparo y ruta del cron

**Files:**
- Create: `src/features/sincronizacion/{worker,operaciones,reintentos,disparar}.ts`, `worker.test.ts`, `operaciones.test.ts`, `reintentos.test.ts`
- Create: `src/app/api/sincronizacion/procesar/route.ts`, `route.test.ts`
- Create: `src/features/sincronizacion/actions.ts` (`procesarAhora`, `reintentarTarea`, y las de consola `procesarAhoraEnFraccionamiento`, `reintentarTareaEnFraccionamiento`) + `actions.test.ts`

**Interfaces:**
- Consumes: cliente (tarea 2), tipos de la cola (tarea 3), `createAdminClient()`, `adquirir_sincronizacion`/`liberar_sincronizacion` (rpc, tarea 1).
- Produces:
  - `reintentos.ts`: `ESCALERA_MS = [60_000, 300_000, 900_000, 3_600_000]`, después `21_600_000`; `MAX_INTENTOS = 20`; `proximoIntento(intentos: number, ahora: Date): Date`.
  - `operaciones.ts`: `ejecutar(ctx: Contexto, tarea: Tarea): Promise<Resultado>` donde `Contexto = { admin: SupabaseClient<Database>; instalacionId: string; api: typeof import('@/lib/access-core') }` y `Resultado = { ok: true } | { ok: false; error: AccessCoreError | Error }`. Una función por `(entidad, operacion)` del spec §3, incluida `domicilio reconciliar`, `domicilio asignar` (lee `perfil_deseado` vía rpc), `pin fijar` (lee `pines_acceso.pin`) y `pin quitar`. `control crear` arma `outputs` desde `fraccionamiento_botones`; un botón sin salida configurada se omite.
  - `worker.ts`: `procesarSincronizaciones({ fraccionamientoId?: number; limite?: number; ahora?: Date }): Promise<{ procesadas: number; fallidas: number; detenidoPor429: boolean }>`: por fraccionamiento, adquiere el lease con un token aleatorio (si no puede, lo salta y lo cuenta en `omitidos`), lo renueva cada 10 tareas y lo libera en `finally`; toma pendientes vencidas por `created_at`; salta las que esperan al `domicilio crear`; marca `ok`/`pendiente`/`error` según §3; con 429 detiene y pone `proximo_intento_at = ahora + retryAfter` a la tarea actual.
  - `disparar.ts`: `dispararSincronizacion(fraccionamientoId: number): void` — `after(() => procesarSincronizaciones({ fraccionamientoId }).catch(console.error))`.
  - `actions.ts`: `procesarAhora(): Promise<ActionResult>` (`ROLES_GESTION`), `reintentarTarea(id: string): Promise<ActionResult>` (comprueba con el cliente de sesión que la tarea existe para el usuario —RLS— y luego, con `createAdminClient()`, la vuelve a `pendiente` con `intentos = 0` y `proximo_intento_at = now()`; después dispara) y las versiones de consola con `runSuperAdminAction` y `fraccionamientoId` explícito.
  - Ruta: `POST /api/sincronizacion/procesar`: `401` si falta `CRON_SECRET` en el entorno o el header no coincide; si no, `procesarSincronizaciones({})` y responde el resumen en JSON.

- [ ] **Step 1: Pruebas** (admin client y `api` simulados):
  - `proximoIntento(0..5)` devuelve +1 min, +5, +15, +1 h, +6 h, +6 h.
  - Orden: tarjeta `crear` con `domicilio crear` pendiente se salta y no suma intento; con el titular `ok`, se procesa y guarda `tarjeta_id`.
  - Tarjeta con `409` → `error`, `intentos 1`, mensaje de la API; otra tarjeta del mismo domicilio sí se procesa.
  - Red caída (`status 0`) → `pendiente`, `intentos + 1`, `proximo_intento_at` según la escalera; con `intentos = 19` → `error`.
  - `429` con `retryAfter 30` → la corrida se detiene (`detenidoPor429`), las siguientes no se tocan.
  - `asignar`: con perfiles `[P1 {holders:[h1]}, P2 {holders:[]}]` y deseado `P2` → `asignarTitulares(P1, [])` y `(P2, [h1])`, `perfil_asignado_id = P2`; deseado nulo → solo quita.
  - `reconciliar`: tarjeta sin `tarjeta_id` con medio permitido → crea; con `tarjeta_id` y medio no permitido → borra y pone nulo; PIN local con medio `pin` y titular sin PIN → `fijarPin` con el valor de `pines_acceso`.
  - `control crear` manda `outputs: { [panel_id]: salida }` por botón según `fraccionamiento_botones`.
  - Lease: sin lease no se procesa nada; se libera al terminar y al fallar; se renueva cada 10 tareas.
  - Ruta: `401` sin header, `401` sin `CRON_SECRET`, `200` con el resumen.
  - `reintentarTarea` de otro fraccionamiento → `MSG_ERROR`/no encontrada, sin tocar la base.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar** (leer `after.md`). **Step 4: Correr** → PASS, `tsc`, `lint`, `build`. **Step 5: Listo para commit.**

---

### Task 5: Consola: instalación, medios y botones

**Files:**
- Modify: `src/features/fraccionamientos/{schemas,actions,queries,messages}.ts`, `components/fraccionamiento-dialog.tsx` (+ tests)
- Create: `src/features/fraccionamientos/{medios-actions,botones-actions}.ts` (+ tests), `components/{medios-fraccionamiento,botones-fraccionamiento}.tsx` (+ tests), `src/features/fraccionamientos/access-core.ts` (`listarInstalacionesDisponibles`, `listarSalidasDe`, con `try/catch` → `null` cuando la API falla)
- Modify: `src/app/admin/fraccionamientos/page.tsx` y `[id]/page.tsx` (pestaña `accesos`: medios, botones y el panel de sincronización de la tarea 9; mientras, un placeholder)

**Interfaces:**
- Consumes: cliente (tarea 2), `encolar` (tarea 3).
- Produces:
  - `fraccionamientoSchema` agrega `instalacionNombre: z.string().nullable()`; `crearFraccionamiento`/`actualizarFraccionamiento` guardan ambos; al **cambiar** `instalacion_id` sobre un fraccionamiento con algún `domicilios.titular_id` no nulo → `fail(MSG_INSTALACION_EN_USO)` ("Este fraccionamiento ya tiene domicilios sincronizados con su instalación"); al **vincular** (de nulo a id) → `encolar` por domicilio `domicilio crear`, `domicilio reconciliar`, `domicilio asignar`, y `dispararSincronizacion(id)`.
  - `FraccionamientoDialog` recibe `instalaciones: { id: string; nombre: string }[] | null` (nulo = la API falló: `Select` deshabilitado con "No se pudo consultar access-core"); opción "Sin instalación" → `''`.
  - `guardarMediosDeFraccionamiento(fraccionamientoId: number, medios: MedioAcceso[]): Promise<ActionResult>` (`runSuperAdminAction`; rechaza `qr`; delete+insert de `fraccionamiento_medios`; traduce `23503` a "Hay tipos de cuota que usan este medio").
  - `guardarBotonesDeFraccionamiento(fraccionamientoId, botones: { boton: 0|1|2|3; panelId: string; panelCodigo: string; salida: 0|1|2|3; salidaAlias: string }[])`: upsert/delete en `fraccionamiento_botones`; después encola `control actualizar` por cada control del fraccionamiento que use un botón cambiado y dispara.
  - `MediosFraccionamiento` (casillas; `qr` deshabilitada con "Próximamente") y `BotonesFraccionamiento` (4 filas, `Select` de salidas con etiqueta "`panel_code` · `alias`" o "Ninguna"; `salidas: null` → deshabilitado con aviso).

- [ ] **Step 1: Pruebas:** esquema con `instalacionNombre`; acción con domicilio sincronizado → mensaje exacto; vincular encola 3 tareas por domicilio en orden; `guardarMedios` con `qr` → `fail`; un administrador → `MSG_NO_PERMISO`; diálogo con `instalaciones: null` muestra el aviso; `BotonesFraccionamiento` con `salidas: null` deshabilitado.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS y los cuatro comandos. **Step 5: Listo para commit.**

---

### Task 6: Tipo de cuota: medios habilitados y permisos

**Files:**
- Modify: `src/features/catalogos/{queries,actions}.ts`, `components/{tipo-cuota-dialog,tipos-cuota-section}.tsx` (+ tests)
- Create: `src/features/catalogos/access-core.ts` (`listarPerfilesDe(instalacionId): Promise<{ id: string; nombre: string }[] | null>`)
- Modify: `src/app/(app)/configuracion/page.tsx`

**Interfaces:**
- Consumes: `listarPerfiles` (tarea 2), `encolar`, `recalcularPermisos`, `dispararSincronizacion` (tareas 3 y 4).
- Produces: `listMediosHabilitados(supabase, fraccionamientoId?: number): Promise<MedioAcceso[]>`; `TipoCuotaDialog` recibe `mediosHabilitados: MedioAcceso[]` y `perfiles: { id; nombre }[] | null`; sin medios muestra "El super admin aún no habilita medios de acceso para este fraccionamiento"; `perfiles: null` → selects deshabilitados con "No se pudo consultar access-core"; sin instalación → "Pide al super admin vincular la instalación de access-core". `guardarTipoCuotaEn`: si cambian `medios` → encola `domicilio reconciliar` por domicilio del tipo; si cambia un permiso → `recalcularPermisos`; en ambos casos dispara.

- [ ] **Step 1: Pruebas:** el diálogo muestra solo las casillas de `mediosHabilitados`; guarda `perfilCorrienteId` y nombre; cambiar medios encola `reconciliar` por cada domicilio del tipo; cambiar permiso llama al rpc; sin cambios no encola nada.
- [ ] **Step 2–5:** FAIL → implementar → PASS y comandos → listo.

---

### Task 7: Domicilios y tarjetas sincronizados; pago recalcula permisos

**Files:**
- Modify: `src/features/domicilios/mutaciones.ts` (+ test), `src/features/domicilios/components/edit-domicilio-dialog.tsx` (aviso al quitar medios), `domicilio-info-card.tsx` (permiso actual)
- Modify: `src/features/accesos/{mutaciones,schemas,messages}.ts`, `components/{accesos-section,acceso-item,numero-dialog}.tsx` (+ tests), `src/features/accesos/queries.ts`
- Create: `src/components/sync-badge.tsx` (+ test)
- Modify: `src/features/pagos/actions.ts` (`registrarPagoCuota` llama a `recalcularPermisos` y dispara al terminar), `src/app/(app)/domicilios/[id]/page.tsx`, `src/app/admin/fraccionamientos/[id]/domicilios/[domicilioId]/page.tsx`

**Interfaces:**
- Consumes: tareas 3 y 4.
- Produces:
  - `crearDomicilioEn` encola `domicilio crear` + `domicilio asignar` y dispara; `actualizarDomicilioEn` encola `domicilio actualizar` si cambió dirección u observaciones, y `reconciliar` + `asignar` si cambió `conceptoId`.
  - `contarRegistrosQueSeOcultan(supabase, domicilioId, mediosNuevos): Promise<{ tarjetas: number; controles: number }>` y el aviso en `EditDomicilioDialog`: "Se ocultarán N tarjetas y M controles y se darán de baja en access-core" cuando N+M > 0.
  - Tarjetas: `tarjetaSchema = { numero: dígitos ≤ 4294967295, descripcion?: string max 60 }`; `crearTarjetaEn(fid, domicilioId, input)` encola `tarjeta crear`; `actualizarTarjetaEn` solo descripción, encola `actualizar`; `eliminarTarjetaEn` encola `borrar` con `carga.tarjeta_id` **antes** de borrar la fila. `AccionesAccesos` cambia las firmas de tarjeta a `(domicilioId, input: TarjetaInput)` / `(id, domicilioId, descripcion: string)`; `operacion-actions.ts` se ajusta.
  - `AccesosSection` recibe `medios: MedioAcceso[]` (de `domicilios_info`) y `estados: Map<number, EstadoEntidad>` por entidad; muestra una tarjeta por medio permitido; sin tipo de cuota, el aviso del spec; teléfonos con "Se sincronizará cuando access-core lo soporte"; `SyncBadge` ("Sincronizado"/"Pendiente"/"Error" + tooltip + "Reintentar" que llama a `reintentarTarea`).
  - `DomicilioInfoCard` muestra "Permiso: <nombre>" según `perfil_asignado_id` ↔ nombres del tipo de cuota, y "Pendiente" si difiere del deseado (el deseado llega por `perfil_deseado` rpc).

- [ ] **Step 1: Pruebas:** crear domicilio encola 2 tareas en orden; sin instalación no encola; cambiar tipo encola `reconciliar` y `asignar`; aviso con los conteos exactos; el número de tarjeta no se puede editar (el diálogo de edición solo muestra descripción); eliminar tarjeta encola `borrar` con `tarjeta_id`; `AccesosSection` oculta tarjetas si `medios` no incluye `tarjeta`; badge "Error" muestra el mensaje; `registrarPagoCuota` llama a `recalcularPermisos`.
- [ ] **Step 2–5:** FAIL → implementar → PASS y comandos → listo.

---

### Task 8: Controles RF y PIN

**Files:**
- Create: `src/features/controles/{schemas,mutaciones,actions,queries,messages}.ts`, `components/{controles-card,control-dialog}.tsx` (+ tests)
- Create: `src/features/pin/{actions,queries,messages}.ts`, `components/pin-card.tsx` (+ tests)
- Modify: `src/features/fraccionamientos/operacion-actions.ts` (versiones de consola), `AccesosSection` (monta `ControlesCard` y `PinCard`), ambas páginas de detalle de domicilio

**Interfaces:**
- Consumes: tareas 2, 3, 4; `fraccionamiento_botones` (tarea 5).
- Produces:
  - `controlSchema = { descripcion?: string max 60; botones: { boton: 0|1|2|3; rfCode: dígitos ≤ 4294967295 }[] min 1 max 4, botones distintos }`; `crearControlEn(fid, domicilioId, input)`, `actualizarControlEn(fid, id, domicilioId, input)`, `eliminarControlEn(fid, id, domicilioId)` con `LIMITES.CONTROLES` y `MSG_MAX_CONTROLES` ("Máximo 2 controles por domicilio"); encolan `control crear|actualizar|borrar` (borrar con `carga.control_id`).
  - `ControlesCard` recibe `botonesConfigurados: number[]`; sin ninguno, botón deshabilitado con "El super admin debe configurar las salidas de los botones"; el diálogo solo ofrece esos botones.
  - PIN (síncrono, sin cola): `fijarPinDomicilio(domicilioId, pin)`, `generarPinDomicilio(domicilioId)`, `quitarPinDomicilio(domicilioId)` (`ROLES_GESTION`; consola con `fraccionamientoId`); leen `domicilios.titular_id` e `instalacion_id`, llaman al cliente y luego escriben `pines_acceso`; `AccessCoreError` → `fail(error.message)`; `AccessCoreNoConfigurado` → `fail('access-core no está configurado')`; sin titular → `fail('El domicilio aún no está sincronizado')`.
  - `PinCard` recibe `pin: string | null | undefined` (`undefined` = el rol no puede verlo → muestra "Asignado"/"Sin PIN") y `sincronizado: boolean`.

- [ ] **Step 1: Pruebas:** esquema rechaza botones repetidos y 5 botones; tercer control → `MSG_MAX_CONTROLES`; crear encola con `botones`; `fijarPin` con `409` devuelve el mensaje de la API y no escribe; `generarPin` guarda el PIN devuelto; sin titular → mensaje exacto; `PinCard` con `pin: undefined` no muestra dígitos; `ControlesCard` sin botones configurados deshabilitado con el aviso.
- [ ] **Step 2–5:** FAIL → implementar → PASS y comandos → listo.

---

### Task 9: Pantalla de sincronización, navegación y documentación

**Files:**
- Create: `src/features/sincronizacion/components/{panel-sincronizacion,tareas-tabla}.tsx` (+ tests), `src/app/(app)/accesos/{page,loading}.tsx` (+ test)
- Modify: `src/components/layout/nav-items.ts` (+ test): "Accesos" (`KeyRound`, roles administrador y tesorero) después de "Residentes"; `src/app/admin/fraccionamientos/[id]/page.tsx` (pestaña `accesos` completa: medios, botones, panel)
- Modify: `README.md`, `docs/integraciones/access-core-mapeo.md` (nuevo), `docs/superpowers/specs/2026-11-09-multitenant-design.md` ("Integración futura" → referencia al spec nuevo)

**Interfaces:**
- Consumes: `listTareasAbiertas`, `resumenSincronizacion`, `procesarAhora`, `reintentarTarea` y sus versiones de consola.
- Produces: `PanelSincronizacion({ resumen, tareas, acciones, tieneInstalacion })`: sin instalación → `EmptyState` con "Pide al super admin vincular la instalación de access-core"; tabla con domicilio, entidad, operación, intentos, error y "Reintentar"; botón "Procesar ahora".

- [ ] **Step 1: Pruebas:** la página exige rol (comité → 404 como `/usuarios`); nav muestra "Accesos" a tesorero y no a comité; panel sin instalación muestra el aviso; "Reintentar" llama a la acción con el id.
- [ ] **Step 2–5:** FAIL → implementar → PASS; verificación final de todo el plan: los cuatro comandos, `supabase test db </dev/null`, demo recargada, `grep -rn "NEXT_PUBLIC_ACCESS\|NEXT_PUBLIC_CRON" src .env.example` → vacío → listo.

## Resultado y pendientes (2026-11-11)

Las 9 tareas están completas y revisadas, y se aplicó la revisión final. Resultados: vitest 933, pgTAP 934, y tsc, lint y build limpios. Nada está commiteado.

**Ajustes durante la ejecución:**
- El advisory lock se reemplazó por un lease (`sincronizacion_leases` con `adquirir_sincronizacion` y `liberar_sincronizacion`), porque el lock se liberaba al terminar cada llamada RPC.
- Se agregó `cancelar_sincronizaciones`. No se permite mientras haya una sincronización en curso.
- La consola no muestra el permiso del domicilio, las tareas `asignar` ni sus errores, para no revelar morosidad.

**Pendientes:**
- **Antes de desplegar:**
  - configurar `ACCESS_CORE_API_KEY`, `ACCESS_CORE_API_URL` y `CRON_SECRET`;
  - configurar el cron del hosting para que llame a `/api/sincronizacion/procesar` cada 5 minutos (acepta GET o POST).
- **Menores aceptados:**
  - El lease se renueva cada 10 tareas, no por tiempo.
  - Un error de base de datos detiene toda la corrida, no solo la del fraccionamiento que falló.
  - Las llaves de idempotencia pueden dar un 422 al reintentar una tarea cuyo cuerpo cambió.
  - El resumen de la consola cuenta también las tareas `asignar`.
  - Queda una ventana corta de carrera al cambiar de instalación.
- **Proyectos siguientes:** 2 (reglas de cobro y morosidad por fraccionamiento) y 3 (lo que falte del cambio automático de permiso).
