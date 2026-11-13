# Servicios para la app móvil (entrega 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constructor visual de botones de la app en la consola, estado de inicio para el residente y endpoints `/api/app/*` (apertura remota y gestión de residentes por el principal), listos para que la app móvil solo dibuje pantallas.

**Architecture:** `app_botones` por fraccionamiento (super admin); RPC `estado_app_domicilio` para el inicio; Route Handlers en `src/app/api/app/**` autenticados con `Authorization: Bearer <access_token>` de Supabase: cliente con el token del residente (RLS) para validar, service-role/llave de access-core solo después. Auditoría en `aperturas_remotas`.

**Tech Stack:** Next.js 16 Route Handlers (leer `node_modules/next/dist/docs/` sobre route handlers antes de escribirlos), Supabase, access-core (`src/lib/access-core`), Vitest, pgTAP, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-13-residentes-app-movil-design.md` (§4 app_botones, estado_app_domicilio, endpoints, constructor; §6 decisiones de apertura, autenticación, botones sin salida, fraccionamiento solo vía RPC).

## Global Constraints

- Modo sin commits: nunca escrituras de git. Solo stack local; comandos `supabase` con `</dev/null`.
- Secretos y service-role solo en servidor y solo después de validar al residente.
- Un residente nunca puede actuar ni leer sobre un domicilio que no le pertenece: responde 404 (no 403) para no revelar existencia.
- Máximo 8 botones por fraccionamiento; `orden` 1–8 único; cuadrícula de 2 columnas, el último impar ocupa todo el ancho y cada botón tiene `ancho_completo`.
- access-core apertura: `POST /installations/{installationId}/outputs/{outputId}/open` con body `{ holder_id: <domicilios.titular_id>, requested_by: "App · <nombre del residente>" }` (≤120 chars, sin caracteres de control) y `Idempotency-Key` nuevo por petición. Sin reintentos automáticos.
- Respuestas de apertura: 200 `{ status: 'opened' | 'denied' | 'failed' | 'timeout' }`; 409 `{ error: 'Tu domicilio tiene adeudos' }` si moroso efectivo; 422 `{ error: 'Este acceso no está disponible' }` si sin instalación, sin `titular_id` o botón sin salida (o access-core 404 de la salida); 429 `{ error: 'Demasiados intentos, espera un momento' }` si >10 aperturas del usuario en 60 s (contadas en `aperturas_remotas`) o access-core 429; 502 `{ error: 'No se pudo abrir, intenta de nuevo' }` si access-core falla; 401 sin token válido; 404 domicilio/botón ajeno.
- Moroso efectivo = la misma regla de `perfil_deseado` (ajuste manual `acceso_forzado` incluido): botones deshabilitados si moroso.
- Si cambia la instalación del fraccionamiento, `app_botones.salida_id` y `salida_nombre` se limpian (botones "sin salida").
- La consola sigue sin mostrar estado de pago; el constructor usa "Ver como moroso" solo como vista previa ficticia.
- Textos en español.

## Review Focus

- Residente con token válido llama `/api/app/domicilios/<id ajeno>/aperturas` ⇒ 404 y no se llama a access-core. (Task 3)
- Token expirado o de un usuario del personal (sin cuenta de residente) ⇒ 401/404, nunca 500. (Task 3)
- Domicilio moroso con `acceso_forzado='activo'` ⇒ puede abrir; al corriente con `'inactivo'` ⇒ 409. (Task 1 pgTAP + Task 3)
- El principal intenta agregar un residente cuando ya está en el máximo ⇒ 422 y no se crea cuenta. (Task 4)
- Un no principal intenta agregar o quitar residentes ⇒ 403. (Task 4)

---

### Task 1: Base de datos — botones, estado de inicio y auditoría

**Files:** Create `supabase/migrations/20261115090000_app_movil.sql`, `supabase/tests/database/085-app-movil.test.sql`; regenerar `src/lib/supabase/database.types.ts`.

**Produces:**
- `public.app_botones(id bigint identity pk, fraccionamiento_id bigint not null fk, orden smallint not null check 1–8, nombre text not null check length 1–30, icono text not null default 'puerta' check in ('puerta','pluma','peatonal','vehiculo','alberca','gimnasio','salon','otro'), ancho_completo boolean not null default false, salida_id uuid null, salida_nombre text null, created_at)`; unique (fraccionamiento_id, orden); trigger que rechaza un 9.º botón (23514). RLS: select super admin y personal del fraccionamiento y residentes de domicilios del fraccionamiento (vía `private.domicilios_del_residente()`); insert/update/delete solo super admin.
- Trigger en `fraccionamientos`: al cambiar `instalacion_id`, `update app_botones set salida_id = null, salida_nombre = null` de ese fraccionamiento.
- `public.aperturas_remotas(id identity pk, created_at, fraccionamiento_id, domicilio_id, boton_id bigint null, user_id uuid, resultado text check in ('opened','denied','failed','timeout','moroso','no_disponible','limite','error'), detalle text null)`; RLS: select super admin y administrador del fraccionamiento; insert solo service-role. Índice (user_id, created_at).
- `public.estado_app_domicilio(p_domicilio_id bigint) returns jsonb` (security definer): exige `private.es_residente_de(p_domicilio_id)` (si no, `42501`); devuelve `{ domicilio: { id, direccion }, fraccionamiento: { nombre, logo_url? (si existe en el esquema) }, moroso: bool, pin: text|null, botones: [{ id, orden, nombre, icono, ancho_completo, habilitado }] }` ordenado por `orden`; `habilitado = not moroso and salida_id is not null and fraccionamiento tiene instalacion_id and domicilio tiene titular_id`. Moroso efectivo: reutilizar la lógica de `perfil_deseado`/`private.es_moroso` + `acceso_forzado` (factorizar `private.moroso_efectivo(p_domicilio_id) returns boolean` si no existe y usarla también en `perfil_deseado` sin cambiar su resultado).
- `private.aperturas_recientes(p_user_id uuid, p_segundos int) returns int`.

- [ ] Step 1 pgTAP: 9.º botón ⇒ 23514; orden duplicado ⇒ 23505; personal no puede insertar botones, super admin sí; residente ve botones de su fraccionamiento y no de otro; cambio de instalación limpia salidas; `estado_app_domicilio` de domicilio ajeno ⇒ 42501; moroso ⇒ todos `habilitado=false`; moroso con `acceso_forzado='activo'` ⇒ `moroso=false`; botón sin salida ⇒ `habilitado=false`; PIN presente; `perfil_deseado` sin regresiones (tests 070/075 siguen pasando); residente no puede leer `aperturas_remotas`.
- [ ] Step 2–4: fallan, migración, toda la suite pasa; tipos regenerados; tsc limpio.

### Task 2: Constructor de botones en la consola

**Files:** Create `src/features/app-botones/{schemas.ts,queries.ts,actions.ts,messages.ts}`, `src/features/app-botones/components/{constructor-botones.tsx,vista-telefono.tsx,boton-form.tsx}` + tests. Modify `src/features/fraccionamientos/tabs.ts` (tab `app` con etiqueta "App de residentes"), página de detalle de la consola `src/app/admin/fraccionamientos/[id]/page.tsx`. Add `listarSalidas(instalacionId)` en `src/lib/access-core/instalaciones.ts` si no existe (ya hay `GET /installations/{id}/outputs`; reutilizar).

**Interfaces:** acciones (super admin): `guardarBoton(fraccionamientoId: number, input: BotonInput & { id?: number })`, `eliminarBoton(fraccionamientoId, id)`, `reordenarBotones(fraccionamientoId, ids: number[])` (reasigna `orden` 1..n en una RPC o en dos pasos sin violar el único: primero +100, luego final). `BotonInput = { nombre: string (1–30), icono: Icono, anchoCompleto: boolean, salidaId: string | null }`; al guardar se copia `salida_nombre` del alias de access-core.

**UI (opción A del usuario + casilla "Ancho completo"):**
- Izquierda: lista ordenable (arrastrar con `@dnd-kit/sortable` si se puede añadir; si no, botones ↑/↓ accesibles) con nombre, salida (o "Sin salida" en ámbar), lápiz, basura; contador "N de 8"; "+ Agregar botón" deshabilitado en 8.
- Formulario (diálogo): Nombre, Ícono (select con íconos lucide), Salida (select de las salidas de la instalación con alias; si no hay instalación, aviso "Liga una instalación en la pestaña Accesos"), casilla "Ancho completo".
- Derecha: `vista-telefono.tsx` — marco de teléfono con "Hola, Residente · Calle Ejemplo 1", cuadrícula 2 columnas (`ancho_completo` o último impar ⇒ `col-span-2`), tarjeta "PIN 1234 · Al corriente", barra de pestañas "Inicio · Domicilio · Accesos · Cuenta"; casilla "Ver como moroso" (botones grises y "Moroso"). Se actualiza en vivo.
- Función pura exportada `distribucion(botones: { ancho_completo: boolean }[]): ('mitad' | 'completo')[]` (el último de un grupo impar de botones de mitad se vuelve completo).

- [ ] Step 1 tests: `distribucion` para 1, 3 (último completo), 4, y [completo, mitad, mitad] (ninguno estirado), [mitad, completo, mitad] (el último mitad queda solo ⇒ completo); 8 botones deshabilita agregar; "Ver como moroso" deshabilita; acciones rechazan no super admin; reordenar.
- [ ] Step 2–4: fallan, implementar, pasan; tsc/eslint.

### Task 3: Autenticación de la app y apertura remota

**Files:** Create `src/lib/app-auth.ts` (+ test), `src/app/api/app/domicilios/[id]/estado/route.ts`, `src/app/api/app/domicilios/[id]/aperturas/route.ts`, `src/app/api/app/yo/route.ts` (+ tests), `src/lib/access-core/salidas.ts` con `abrirSalida(instalacionId, salidaId, { holderId, requestedBy })`.

**Interfaces:**
- `autenticarResidente(request: Request): Promise<{ ok: true; userId: string; supabase: SupabaseClient<Database> } | { ok: false; status: 401 }>` — lee `Authorization: Bearer`, valida con `supabase.auth.getUser(token)`, exige fila activa en `cuentas_residente`; devuelve cliente con el token (RLS del residente).
- `GET /api/app/yo` ⇒ `{ telefono, domicilios: [{ id, direccion, fraccionamiento, es_principal }] }`.
- `GET /api/app/domicilios/[id]/estado` ⇒ resultado de `estado_app_domicilio` (42501 ⇒ 404).
- `POST /api/app/domicilios/[id]/aperturas` body `{ botonId: number }` ⇒ según Global Constraints; orden: auth → estado (pertenencia/moroso/habilitado) → límite → leer `instalacion_id`, `titular_id`, `salida_id` con service-role → `abrirSalida` → insertar auditoría (siempre, también en rechazos 409/422/429/502). `requested_by` = `App · <nombre del residente en ese domicilio>` recortado a 120.

- [ ] Step 1 tests (mocks de supabase y access-core): sin header ⇒ 401; token inválido ⇒ 401; usuario sin `cuentas_residente` ⇒ 401; domicilio ajeno ⇒ 404 y `abrirSalida` no llamado; moroso ⇒ 409 + auditoría `moroso`; botón sin salida ⇒ 422; 11.ª apertura en 60 s ⇒ 429; access-core 502 ⇒ 502 + auditoría `error`; éxito ⇒ 200 `{ status: 'opened' }` con `holder_id` = titular e `Idempotency-Key` presente; `denied` del panel ⇒ 200 `{ status: 'denied' }`.
- [ ] Step 2–4: fallan, implementar, pasan.

### Task 4: Gestión de residentes por el principal

**Files:** Create `src/app/api/app/domicilios/[id]/residentes/route.ts` (GET, POST), `src/app/api/app/domicilios/[id]/residentes/[residenteId]/route.ts` (DELETE) + tests. Reutilizar `src/features/residentes/acceso-app.ts` / `cuentas.ts` (añadir variantes que validen "es principal del domicilio" en lugar de rol de personal).

**Interfaces:**
- GET ⇒ lista de residentes del domicilio `{ id, nombre, telefono, es_principal, con_acceso }` (cualquier residente del domicilio).
- POST (solo principal) body `{ nombre, telefono, password? }` ⇒ crea residente + acceso (crea o vincula cuenta); 403 si no es principal; 422 `{ error }` si máximo alcanzado, teléfono inválido, contraseña requerida/corta, o ya tiene acceso en el domicilio; 201 `{ id, cuentaCreada }`. El residente se inserta con service-role tras validar (los residentes no tienen permiso de insert por RLS).
- DELETE (solo principal; no a sí mismo ⇒ 422 "No puedes quitarte a ti mismo") ⇒ misma limpieza que `eliminarResidenteEn` (teléfono auto, desactivar cuenta si no le quedan domicilios); 204.
- [ ] Step 1 tests: no principal ⇒ 403 (POST/DELETE); máximo ⇒ 422 sin `createUser`; teléfono existente ⇒ vincula sin password (201 `cuentaCreada:false`); quitarse a sí mismo ⇒ 422; residente de otro domicilio ⇒ 404.
- [ ] Step 2–4: fallan, implementar, pasan.

### Task 5: Cierre

- [ ] `docs/integraciones/api-app-movil.md`: contrato de cada endpoint (método, ruta, headers, cuerpos, respuestas y códigos), cómo iniciar sesión con el SDK (`signInWithPassword({ email: '<tel>@auth.internal', password })`), lectura directa permitida por RLS, distribución de botones.
- [ ] `demo-local.sql`: 3 botones de ejemplo en el fraccionamiento demo (uno con salida nula). README: enlace al contrato.
- [ ] Verificación: `supabase db reset </dev/null`, `supabase test db </dev/null`, demo, `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`, `npm run build`; prueba manual con curl: iniciar sesión como `3300000001@auth.internal` contra el Auth local, `GET /api/app/yo` y `GET /api/app/domicilios/<id>/estado` con el token (`next dev` debe estar corriendo; si no, documentar y omitir).

## Resultado y pendientes (2026-11-13)

Completo, sin commits. pgTAP 1050, vitest 1112+1, tsc/eslint/build limpios; smoke con curl como residente demo (yo/estado/residentes 200; domicilio ajeno 404; sin token 401). Revisión final sin hallazgos críticos/importantes.
Correcciones fuera del plan: el proxy redirigía `/api/app/*` y `/api/sincronizacion/procesar` al login (el cron de access-core nunca habría corrido); ambas rutas autentican por Bearer y quedaron exentas.
Decisiones: reordenar botones con RPC y único diferible; límite de aperturas no atómico; apertura real no probada de punta a punta (demo sin instalación de access-core); contrato en docs/integraciones/api-app-movil.md.
Siguiente: la app móvil (React Native/Expo propuesto), QR de invitación, Stripe.
