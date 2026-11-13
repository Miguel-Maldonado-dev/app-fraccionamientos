# App móvil de residentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Expo de residentes en `mobile/` (login, Inicio con aperturas, Domicilio, Accesos, Cuenta) más los cambios de servidor que necesita: recibo PDF por Bearer, lectura de cuotas/pagos, y cuenta ligada a un dispositivo con desligado desde la web.

**Architecture:** Servidor (Tasks 1–2) en el proyecto Next/Supabase existente; cliente (Tasks 3–6) en un proyecto Expo independiente dentro de `mobile/` con su propio `package.json`, Expo Router (pestañas), supabase-js con `expo-secure-store`, y un cliente `fetch` hacia `/api/app/*` que manda `Authorization: Bearer` y `X-Device-Id`.

**Tech Stack:** Next.js 16 (leer `node_modules/next/dist/docs/`), Supabase, Expo (última SDK estable, versiones exactas), Expo Router, TypeScript estricto, `lucide-react-native`, `@expo-google-fonts/sora`, `@expo-google-fonts/inter`, `expo-secure-store`, `expo-file-system`, `expo-sharing`, `expo-haptics`, jest-expo + React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-app-movil-residentes-design.md`

## Global Constraints

- Modo sin commits: nunca escrituras de git. Solo stack local; `supabase` con `</dev/null`. Nunca proyectos remotos.
- `mobile/` no debe romper la web: la raíz excluye `mobile/` de su `tsconfig`, eslint y vitest; `mobile/` tiene sus propios scripts (`npm test`, `npx tsc --noEmit`, `npx expo lint` si aplica).
- Dependencias de `mobile/` con versión exacta (sin `^`), compatibles con la SDK elegida (`npx expo install`).
- Solo variables `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`; nada secreto en la app.
- Correo sintético `<10 dígitos>@auth.internal` con la misma normalización que `src/features/residentes/telefono.ts`.
- Marca: primario `#087BE8`, navy `#071F49`, fondo `#F5F8FC`, superficie `#FFFFFF`, borde `#E8EEF4`, texto `#172536`, secundario `#496985`; Sora títulos, Inter texto; logo `docs/marca/logos/`.
- Pestañas con ícono de línea + etiqueta: Inicio, Domicilio, Accesos, Cuenta.
- Botones: 2 columnas; `ancho_completo` o último impar de mitad ⇒ ancho completo; gris si `habilitado=false`.
- Textos exactos: "Teléfono o contraseña incorrectos"; "Tu cuenta no tiene acceso a la app. Contacta a la administración."; "Tu domicilio tiene adeudos. Los accesos remotos se reactivan al ponerte al corriente."; "Abriendo…", "Abierto ✓", "No se pudo abrir"; "Al corriente" / "Con adeudo"; "Sin conexión, intenta de nuevo"; "Se vinculó la cuenta existente" / "Residente agregado"; dispositivo: "Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue."
- Dispositivo: header `X-Device-Id` (UUID generado una vez y guardado en secure store); 403 `{ error, codigo: 'otro_dispositivo' }`; header faltante ⇒ 400.
- La app no calcula estatus: usa `moroso` de `/estado` y `estatus_calculado` de las vistas.

## Review Focus

- Segundo dispositivo con la misma cuenta ⇒ 403 `otro_dispositivo` en todos los `/api/app/*`; tras desligar en la web, el nuevo queda ligado. (Task 1)
- Residente pide recibo de un pago de otro domicilio ⇒ 404. (Task 1)
- Token expira con la app abierta ⇒ se renueva y la llamada se reintenta una vez; si no, vuelve a login. (Task 3)
- Doble toque rápido en un botón de apertura ⇒ una sola petición. (Task 4)
- Cambiar de domicilio con el selector ⇒ Inicio, Domicilio y Accesos muestran solo el nuevo. (Task 4/5)

---

### Task 1: Servidor — dispositivo ligado, recibo por Bearer, lectura de cuotas/pagos

**Files:** Create `supabase/migrations/20261116090000_dispositivos_residente.sql`, `supabase/tests/database/090-dispositivos.test.sql`; modify `src/lib/app-auth.ts` (+ test), all `src/app/api/app/**/route.ts` (via the shared auth helper); create `src/app/api/app/pagos/[id]/recibo/route.ts` (+ test); update `docs/integraciones/api-app-movil.md`.

**Produces:**
- `public.dispositivos_residente(user_id uuid pk references cuentas_residente on delete cascade, device_id text not null check length 8–100, nombre text null check length ≤ 80, ligado_en timestamptz default now())`. RLS: select propio (residente) y administrador/tesorero si la cuenta tiene residente en su fraccionamiento; escritura solo service-role.
- Verificar (pgTAP) que un residente puede leer `cuotas_info` y `pagos_info` de sus domicilios y nada más; si los grants lo impiden, corregirlos en esta migración.
- `autenticarResidente(request)` ahora también exige `X-Device-Id` (falta ⇒ `{ ok:false, status:400 }`), lee/inserta en `dispositivos_residente` con service-role tras validar el token (primer uso liga; también guarda `X-Device-Name` si viene, recortado a 80); distinto ⇒ `{ ok:false, status:403, codigo:'otro_dispositivo' }`. Las rutas devuelven el JSON exacto de Global Constraints.
- `GET /api/app/pagos/[id]/recibo`: cliente del residente (RLS) lee el pago con `getPagoRecibo`; no visible o sin recibo ⇒ 404; si no, PDF de `generarReciboPdf` (mismo nombre de archivo y headers que `/api/recibos/[pagoId]`).
- Contrato actualizado: headers nuevos, 400/403, endpoint de recibo, vistas legibles (`cuotas_info`, `pagos_info`, `tarjetas_acceso`, `controles_acceso`, `pines_acceso`, `telefonos_acceso`, `residentes`, `app_botones`).

- [ ] Step 1 tests: pgTAP (residente lee sus filas de las dos vistas y 0 ajenas; no puede escribir `dispositivos_residente`; admin de otro fraccionamiento no ve el dispositivo). vitest: sin header ⇒ 400; primer uso liga; mismo id ⇒ ok; otro id ⇒ 403 con `codigo`; recibo ajeno ⇒ 404; recibo propio ⇒ 200 `application/pdf`.
- [ ] Step 2–4: fallan, implementar, pasan; pgTAP completo, `npx vitest run` (solo), tsc, eslint.

### Task 2: Web — dispositivo en residentes y "Desligar dispositivo"

**Files:** modify `src/features/residentes/components/residentes-table.tsx` (o donde se muestra "App"), `residente-actions.tsx`, `acciones.ts`; add `desligarDispositivo(residenteId: number): Promise<ActionResult>` en `src/features/residentes/cuentas-actions.ts` (lógica en `acceso-app.ts`) + tests.

- Solo administrador. Valida con su cliente RLS que el residente sea visible y tenga `user_id`; luego service-role `delete from dispositivos_residente where user_id = …`. Mensaje de éxito "Dispositivo desligado".
- Insignia en residentes con cuenta: "Dispositivo: <nombre o 'Sin nombre'> · ligado el <fecha>" o "Sin dispositivo". Acción "Desligar dispositivo" con confirmación: "El residente podrá iniciar sesión en un teléfono nuevo."
- [ ] Step 1 tests: tesorero no ve la acción; acción llama a la action; action rechaza residente no visible sin tocar service-role; borra la fila.
- [ ] Step 2–4: fallan, implementar, pasan.

### Task 3: Proyecto Expo, sesión y cliente API

**Files:** Create `mobile/` (Expo Router, TypeScript), `mobile/README.md` (cómo correr con Expo Go: `next dev -H 0.0.0.0`, IP local en `mobile/.env`, usuario demo `3300000001`/`residente123`), `mobile/.env.example`, `mobile/src/lib/{telefono.ts,supabase.ts,dispositivo.ts,api.ts,tema.ts,botones.ts}` + tests, `mobile/app/login.tsx`, `mobile/app/(tabs)/_layout.tsx` (4 pestañas con íconos lucide + etiqueta, placeholders). Modify root `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts` para excluir `mobile/`.

**Produces:**
- `normalizarTelefono(valor: string): string | null` (copia exacta de la web con sus casos de prueba) y `correoSintetico(tel)`.
- `obtenerDeviceId(): Promise<string>` (UUID v4 persistente en secure store).
- `api<T>(ruta: string, init?: RequestInit): Promise<T>` — agrega `Authorization` y `X-Device-Id` (+ `X-Device-Name` del modelo con `expo-device` si está disponible); en 401 intenta `supabase.auth.refreshSession()` y reintenta una vez; lanza `ApiError { status, mensaje, codigo? }`; error de red ⇒ `ApiError(0, 'Sin conexión, intenta de nuevo')`.
- `distribucion(botones: { ancho_completo: boolean }[]): ('mitad' | 'completo')[]` (misma regla que `src/features/app-botones`; copiar casos de prueba).
- Contexto de sesión + domicilio seleccionado (`useSesion()`, `useDomicilio()`), último domicilio recordado en secure store.
- Login: teléfono + contraseña; credenciales inválidas ⇒ "Teléfono o contraseña incorrectos"; tras login llama `GET /api/app/yo`: 401 ⇒ cerrar sesión + "Tu cuenta no tiene acceso a la app. Contacta a la administración."; 403 `otro_dispositivo` ⇒ cerrar sesión + mensaje de dispositivo.
- Fuentes Sora/Inter y tema con los colores de Global Constraints.
- [ ] Step 1 tests (jest-expo): normalización; `api` agrega headers, reintenta tras refresh, mapea red/403/409; `distribucion`; login muestra cada mensaje según la respuesta.
- [ ] Step 2–4: fallan, implementar, pasan (`cd mobile && npm test && npx tsc --noEmit`); la web sigue limpia (`npx tsc --noEmit`, `npx eslint src`, `npx vitest run` en la raíz).

### Task 4: Inicio

**Files:** `mobile/app/(tabs)/index.tsx`, `mobile/src/components/{encabezado.tsx,selector-domicilio.tsx,boton-acceso.tsx,tarjeta-pin.tsx}` + tests.

- Encabezado "Hola, <nombre>" + domicilio; selector solo si hay >1 domicilio.
- Botones según `distribucion`; estados: normal → "Abriendo…" (deshabilitado, evita doble toque) → "Abierto ✓" 2 s (vibración ligera) / "No se pudo abrir" (`denied|failed|timeout`) / mensaje del servidor (409/422/429/502).
- Tarjeta PIN oculto (••••, ojo para mostrar) + "Al corriente"/"Con adeudo" según `moroso`; aviso de moroso; jalar para actualizar.
- [ ] Step 1 tests: impar ⇒ último completo; deshabilitado gris; doble toque ⇒ una llamada; cada estado de respuesta; moroso muestra aviso y "Con adeudo"; cambio de domicilio recarga.
- [ ] Step 2–4.

### Task 5: Domicilio, Accesos y Cuenta

**Files:** `mobile/app/(tabs)/domicilio.tsx`, `accesos.tsx`, `cuenta.tsx`, `mobile/app/recibo/[id].tsx`, `mobile/app/residentes/agregar.tsx`, componentes + tests.

- Domicilio: cuotas de `cuotas_info` (periodo, importe, `estatus_calculado`) filtradas por domicilio; recibos de `pagos_info` (los sin recibo sin "Ver"); pantalla de recibo con los datos y "Compartir PDF" (descarga `/api/app/pagos/{id}/recibo` con headers a un archivo temporal y abre `expo-sharing`); residentes con "N de M" (M = máximo devuelto por el endpoint si existe; si no, solo N); principal: "+ Agregar residente" (nombre, teléfono, contraseña opcional) y "Quitar" con confirmación; mensajes de éxito según `cuentaCreada`; errores del servidor tal cual.
- Accesos: tarjetas, controles, PIN (oculto), teléfonos del domicilio, solo lectura.
- Cuenta: mis domicilios (cambia el seleccionado), cambiar contraseña (≥ 8, `updateUser`), acerca de (versión de `expo-application`/`Constants`), cerrar sesión.
- [ ] Step 1 tests: no principal no ve agregar/quitar; agregar muestra "Se vinculó la cuenta existente" con `cuentaCreada:false`; pago sin recibo sin "Ver"; contraseña corta rechazada; cerrar sesión vuelve a login.
- [ ] Step 2–4.

### Task 6: Cierre

- [ ] `mobile/README.md` completo; README raíz enlaza a `mobile/`; `.gitignore` cubre `mobile/node_modules`, `mobile/.expo`, `mobile/.env`.
- [ ] Verificación: raíz (`supabase db reset </dev/null`, `supabase test db </dev/null`, demo-local, `npx vitest run`, tsc, eslint, `npm run build`); `mobile/` (`npm test`, `npx tsc --noEmit`, `npx expo export --platform web` o `npx expo-doctor` para validar que el proyecto compila).
- [ ] Smoke con curl de los headers de dispositivo (primer id liga, segundo 403, desligar con service-role en local y reintentar ok).
- [ ] Instrucciones para que el usuario pruebe en su teléfono con Expo Go (no automatizable).

## Resultado y pendientes (2026-11-14)

Completo, sin commits. pgTAP 1059 (también con demo cargada), vitest raíz 1132, mobile 82, tsc/eslint/build limpios, expo-doctor 20/20, `expo export` Android OK; smoke de dispositivo con curl (A 200, B 403, sin header 400, tras desligar B 200). Revisión final sin hallazgos críticos/importantes.
Extras: dependencia `server-only@0.0.1`; `mobile/metro.config.js` excluye pruebas del bundle; almacenamiento de sesión fragmentado en SecureStore; pruebas 080/085 con teléfonos propios.
Pendiente: probar en un teléfono real con Expo Go (guía en mobile/README.md) y la apertura con una instalación real de access-core. Siguiente: QR de invitación, Stripe, despliegue.
