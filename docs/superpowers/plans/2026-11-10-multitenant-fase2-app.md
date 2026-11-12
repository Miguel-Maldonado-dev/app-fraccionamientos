# Multi-tenant, fase 2 (app con tenant): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La app Next.js funciona sobre el esquema multi-tenant de la fase 1: roles del enum, contexto del fraccionamiento, acceso según perfil y estado, alta de usuarios con service role y el nombre del fraccionamiento en la interfaz.

**Architecture:** Un helper de servidor `getTenantContext()` (con `React.cache`) lee el perfil propio y su fraccionamiento, y es la única fuente del rol. Los layouts redirigen según el estado del acceso. Las lecturas no filtran por fraccionamiento: lo hace RLS. El alta de usuarios usa un cliente con service role, solo en el servidor.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19.2, `@supabase/ssr` 0.12 + `supabase-js` 2.117, Zod 4, react-hook-form, shadcn/ui, Vitest 5 + Testing Library. Supabase local (fase 1) en `http://127.0.0.1:55321`.

**Spec:** `docs/superpowers/specs/2026-11-09-multitenant-design.md` (sección 3). Notas de entrada: final de `docs/superpowers/plans/2026-11-09-multitenant-fase1-esquema.md`.

## Global Constraints

- **No hacer commits.** El usuario hace todos los commits.
- **Next.js 16 no es el que conoces.** Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md). En particular: el middleware se llama `proxy` (`src/proxy.ts`).
- **No levantar el servidor** (`npm run dev`, `next start`). Validar con `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build`. Al cerrar cada tarea los cuatro deben pasar.
- **Base de datos:** no modificar las migraciones de la fase 1. Si hace falta un cambio de esquema, se crea una migración nueva con `supabase migration new <nombre> </dev/null` y se acompaña de pruebas pgTAP. `supabase db reset </dev/null && supabase test db </dev/null` debe seguir en verde. Todos los comandos `supabase` llevan `</dev/null`.
- **Tipos:** `src/lib/supabase/database.types.ts` se regenera con `supabase gen types typescript --local > src/lib/supabase/database.types.ts`. Nunca se edita a mano.
- **Roles:** los valores son los del enum `rol_usuario`: `super_admin`, `administrador`, `tesorero`, `comite`, `vigilancia`. Etiquetas para mostrar: `Super admin`, `Administrador`, `Tesorero`, `Comité`, `Vigilancia`.
- **Service role:** la llave `SUPABASE_SERVICE_ROLE_KEY` solo se lee en módulos de servidor que importan `'server-only'`. Nunca con prefijo `NEXT_PUBLIC_`.
- **Sin filtros por fraccionamiento en lecturas ni `fraccionamiento_id` en inserciones de la app:** RLS y el default de la base lo resuelven.
- **Textos en español**, sentence case, como el resto de la app. TDD: la prueba primero.
- **Producto:** el nombre genérico del producto vive en una sola constante, `PRODUCTO` en `src/lib/constants.ts`, con el valor `'Fraccionamientos'` hasta que el usuario defina otro.
- **Fuera de alcance de esta fase:** consola `/admin` completa (fase 3; aquí solo un esqueleto protegido), recibos PDF y exportaciones ZKTeco/Eldesgate (fase 4; dependen de edge functions que no existen en el proyecto nuevo).

## Decisiones tomadas en este plan

1. **Redirecciones por estado en layouts, no en `proxy`.** El proxy sigue igual que hoy (sesión y `/login`). Así se evita una consulta extra por cada petición. `(app)/layout.tsx` redirige al super admin a `/admin` y a quien no tiene acceso a `/sin-acceso`; `admin/layout.tsx` responde 404 a cualquier rol que no sea super admin. El comportamiento visible es el del spec.
2. **`getCurrentUser` se reemplaza por `getTenantContext`.** El archivo `src/lib/auth/current-user.ts` se elimina; `requireUser`, `requireRole` y `runAction` usan el contexto nuevo.
3. **Permisos de columna en `perfiles`** (pendiente 2 de la fase 1): se quita `insert` a `authenticated` y `update` queda limitado a `(nombre, rol, activo)`. Una migración nueva en la tarea 3.
4. **Fraccionamiento de demostración local** como script manual (`supabase/scripts/demo-local.sql`), no en `seed.sql`, para no alterar las cuentas de las pruebas pgTAP.

## Review Focus

1. **Usuario con sesión cuyo fraccionamiento se desactiva.** En la siguiente navegación va a `/sin-acceso`, y sus Server Actions responden "Tu sesión expiró…", sin errores 500. Prueba en la tarea 2.
2. **Usuario de Auth sin perfil** (por ejemplo, un alta a medias). Va a `/sin-acceso` y no rompe el layout. Prueba en la tarea 2.
3. **Alta con un email que ya existe.** Mensaje "Ya existe un usuario con ese email." y no queda ningún perfil huérfano. Prueba en la tarea 3.
4. **Falla al guardar el perfil después de crear el usuario en Auth.** Se borra el usuario de Auth. Si también falla el borrado, se registra en `console.error` y el mensaje al usuario es el genérico. Prueba en la tarea 3.
5. **Super admin que abre una ruta de la app** (`/domicilios`): termina en `/admin`, no en una pantalla vacía. Prueba en la tarea 2.

---

### Task 1: Tipos regenerados y roles del enum

**Files:**
- Modify: `src/lib/supabase/database.types.ts` (regenerado)
- Modify: `src/lib/constants.ts`, `src/lib/auth/current-user.ts`, `src/components/status-badge.tsx`, `src/features/reportes/queries.ts`
- Modify: `src/features/usuarios/{queries,schemas,actions}.ts`, `src/features/usuarios/components/{add-user-dialog,edit-user-dialog,usuarios-table,usuarios-view}.tsx`, `src/app/(app)/usuarios/page.tsx`
- Modify: los tests existentes que usan los valores viejos de rol o `users_info.role_name`/`role_id`.

**Interfaces:**
- Produces, en `src/lib/constants.ts`:
  - `export type Rol = Database['public']['Enums']['rol_usuario']`
  - `export const ROLES = { ADMINISTRADOR: 'administrador', TESORERO: 'tesorero', COMITE: 'comite', VIGILANCIA: 'vigilancia' } as const`. `RoleName` sigue siendo `(typeof ROLES)[keyof typeof ROLES]`.
  - `export const SUPER_ADMIN = 'super_admin' as const`
  - `export const ROLES_FRACCIONAMIENTO = [ROLES.ADMINISTRADOR, ROLES.TESORERO, ROLES.COMITE, ROLES.VIGILANCIA] as const` (tupla, para `z.enum`)
  - `export const ROL_LABEL: Record<Rol, string>` con las etiquetas de Global Constraints.
  - `export const PRODUCTO = 'Fraccionamientos'`
- Produces, en `src/features/usuarios/schemas.ts`: `nuevoUsuarioSchema` y `editarUsuarioSchema` con `rol: z.enum(ROLES_FRACCIONAMIENTO)` en lugar de `roleId`.
- `CurrentUser` (temporal, lo reemplaza la tarea 2): `{ id, email, userName, roleName: RoleName | null, isActive }`, sin `roleId`.

- [ ] **Step 1: Regenerar tipos** con el comando de Global Constraints. `npx tsc --noEmit` debe fallar en los archivos listados (`users`, `user_roles`, `roles`, `role_name`, `role_id`); anotar la lista en el reporte.
- [ ] **Step 2: Actualizar pruebas primero:**
  - `current-user.test.ts`: la fila de `users_info` trae `rol: 'tesorero'` y se mapea a `roleName: 'tesorero'`. `rol: 'super_admin'` da `roleName: null`, porque no es un rol de fraccionamiento.
  - `schemas.test.ts` (usuarios): `rol: 'comite'` es válido y `rol: 'super_admin'` es inválido, con el mensaje "Selecciona un rol".
  - `actions.test.ts` (usuarios):
    - `actualizarUsuario` hace `update` en `perfiles` con `{ nombre, rol }`.
    - `cambiarEstadoUsuario` hace `update` en `perfiles` con `{ activo }`.
    - Cambiar el propio rol → `MSG_NO_AUTO_CAMBIAR_ROL`; desactivarse a sí mismo → `MSG_NO_AUTO_DESACTIVAR`.
  - `usuarios-view.test.tsx` y `usuarios-table`: la columna Rol muestra `Comité` para `rol: 'comite'`.
  - Reportes: `listUsuariosReporte` filtra `.in('rol', ['administrador', 'tesorero'])`.
- [ ] **Step 3: Correr** `npm test` → FAIL en las pruebas tocadas.
- [ ] **Step 4: Implementar.**
  - `listRoles` desaparece: los diálogos reciben las opciones de `ROLES_FRACCIONAMIENTO` con `ROL_LABEL`.
  - `status-badge` resuelve el tono por la etiqueta (`Administrador`, `Tesorero`), como hoy.
  - `crearUsuario` sigue llamando a la edge function con `rol` en lugar de `role_id`. La tarea 3 la reemplaza.
- [ ] **Step 5: Verificar:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → todo en verde.
- [ ] **Step 6: Listo para commit.**

---

### Task 2: Contexto del tenant, acceso por estado y página `/sin-acceso`

**Files:**
- Create: `src/lib/auth/tenant-context.ts`, `src/lib/auth/tenant-context.test.ts`
- Delete: `src/lib/auth/current-user.ts`, `src/lib/auth/current-user.test.ts`
- Modify: `src/lib/auth/require-role.ts`, `src/lib/auth/run-action.ts` (+ su test), `src/app/(app)/layout.tsx`, `src/app/api/recibos/[pagoId]/route.ts`, `src/features/reportes/export-proxy.ts`, `src/app/(app)/usuarios/page.tsx` y cualquier otro importador de `current-user`.
- Create: `src/app/sin-acceso/page.tsx` (+ test), `src/app/admin/layout.tsx`, `src/app/admin/page.tsx` (+ test del layout)

**Interfaces:**
- Produces, en `src/lib/auth/tenant-context.ts`:
  - `export type Perfil = { nombre: string; email: string; rol: Rol; activo: boolean; fraccionamientoId: number | null }`
  - `export type TenantContext = { userId: string; email: string; perfil: Perfil | null; fraccionamiento: { id: number; nombre: string } | null }`
  - `export type EstadoAcceso = 'app' | 'super_admin' | 'sin_acceso'`
  - `export function estadoAcceso(ctx: TenantContext): EstadoAcceso`. Devuelve `'super_admin'` si hay perfil activo con rol super admin; `'app'` si hay perfil activo, rol de fraccionamiento y `fraccionamiento` no nulo; `'sin_acceso'` en cualquier otro caso: sin perfil, perfil inactivo, o fraccionamiento inactivo, que RLS oculta y por eso llega null.
  - `export const getTenantContext = cache(async (): Promise<TenantContext | null>)`. Devuelve `null` sin sesión. Lee `perfiles` por `id = claims.sub` (el propio perfil siempre es visible) y, si tiene `fraccionamiento_id`, `fraccionamientos` (`id, nombre`) con `maybeSingle()`. Un error de consulta lanza `Error`.
  - `export type CurrentUser = { id: string; email: string; userName: string; roleName: RoleName | null; isActive: boolean; fraccionamientoId: number | null }`
  - `export async function getCurrentUser(): Promise<CurrentUser | null>`: derivado del contexto, con `isActive = estadoAcceso(ctx) === 'app'`. El super admin tiene `isActive: false` dentro de la app, porque sus acciones se hacen desde `/admin`.
- Redirecciones:
  - `(app)/layout.tsx`: sin contexto → `/login`; `super_admin` → `redirect('/admin')`; `sin_acceso` → `redirect('/sin-acceso')`.
  - `admin/layout.tsx`: cualquier otro estado distinto de `super_admin` → `notFound()`.
  - `/sin-acceso`: muestra exactamente "Tu acceso está desactivado. Contacta al administrador." y un botón "Cerrar sesión" que lleva a `/api/auth/signout`. Si no hay sesión, redirige a `/login`.
  - `admin/page.tsx`: `PageHeader` con título "Fraccionamientos" y el texto "La consola del super admin estará disponible pronto." (la fase 3 la reemplaza).

- [ ] **Step 1: Escribir pruebas:**
  - `estadoAcceso`: los cinco casos (sin perfil; perfil inactivo; administrador con fraccionamiento null; administrador con fraccionamiento; super admin activo).
  - `getTenantContext` con el fake de Supabase existente (`src/test/fake-query.ts`): sin claims → null; perfil + fraccionamiento → contexto completo; perfil sin fila de fraccionamiento → `fraccionamiento: null`.
  - `run-action.test.ts`: con un contexto `sin_acceso`, `runAction` devuelve `MSG_SESION` (Review Focus 1).
  - Layout `(app)`: super admin → `redirect('/admin')` (Review Focus 5); sin perfil → `redirect('/sin-acceso')` (Review Focus 2).
  - Layout `admin`: administrador → `notFound()`.
  - `/sin-acceso`: muestra el texto exacto y el botón.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Al terminar no debe quedar ningún import de `@/lib/auth/current-user` (`grep -rn "auth/current-user" src` vacío).
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 3: Alta de usuarios con service role y permisos de columna en `perfiles`

**Files:**
- Create: `src/lib/supabase/admin.ts`, `src/features/usuarios/alta.ts`, `src/features/usuarios/alta.test.ts`
- Modify: `src/features/usuarios/actions.ts` (+ test), `src/features/usuarios/messages.ts`, `.env.example`, `README.md` (variables de entorno)
- Create: `supabase/migrations/<ts>_perfiles_permisos_columnas.sql`, `supabase/tests/database/025-perfiles-columnas.test.sql`
- Modify (local, no versionado): `.env.local` con `SUPABASE_SERVICE_ROLE_KEY` local, tomada de `supabase status -o json </dev/null` (`SERVICE_ROLE_KEY`).

**Interfaces:**
- Consumes: `CurrentUser.fraccionamientoId` (tarea 2), `nuevoUsuarioSchema` con `rol` (tarea 1).
- Produces:
  - `src/lib/supabase/admin.ts`: `import 'server-only'`; `export function createAdminClient(): SupabaseClient<Database>` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (lanza si falta), `auth: { persistSession: false, autoRefreshToken: false }`.
  - `src/features/usuarios/alta.ts`: `export async function altaUsuario(admin: SupabaseClient<Database>, datos: { fraccionamientoId: number; rol: RoleName; nombre: string; email: string; password: string }): Promise<{ ok: true; id: string } | { ok: false; motivo: 'email_duplicado' | 'error' }>`
    1. `admin.auth.admin.createUser({ email, password, email_confirm: true })`. Si el error indica email existente (`code === 'email_exists'` o status 422), devuelve `email_duplicado`.
    2. `insert` en `perfiles` con `{ id, fraccionamiento_id, rol, nombre, email }`.
    3. Si el insert falla: `admin.auth.admin.deleteUser(id)`. Si eso también falla, `console.error`. En ambos casos devuelve `error`.

    La fase 3 reutiliza esta función.
  - `crearUsuario(input)`: `runAction([ROLES.ADMINISTRADOR], …)` → valida con el esquema → `altaUsuario(createAdminClient(), { fraccionamientoId: user.fraccionamientoId!, … })`. Mensajes nuevos en `messages.ts`: `MSG_EMAIL_DUPLICADO = 'Ya existe un usuario con ese email.'`. Para `error` se usa `MSG_ERROR` de `run-action`.
  - Migración: `revoke insert on public.perfiles from authenticated; revoke update on public.perfiles from authenticated; grant update (nombre, rol, activo) on public.perfiles to authenticated;`. La política `perfiles_insert` queda sin efecto para `authenticated`; se conserva para el super admin desde la fase 3, que usa service role.
  - `.env.example`: agrega `SUPABASE_SERVICE_ROLE_KEY=` con un comentario: "Solo servidor. Nunca con prefijo NEXT_PUBLIC_."

- [ ] **Step 1: Pruebas pgTAP** (`025-perfiles-columnas.test.sql`):
  - Como `admin.a`: `insert` en `perfiles` → `'42501'`; `update perfiles set id = …` → `'42501'`; `update perfiles set email = …` → `'42501'`; `update perfiles set nombre = 'X'` sobre `tesorero.a` afecta 1 fila.
  - Ajustar en `020` las aserciones de insert de perfiles por `admin.a` que dependían del permiso de tabla, si alguna deja de cumplirse.
- [ ] **Step 2: Pruebas Vitest** (`alta.test.ts`, `actions.test.ts`) con un fake del cliente admin:
  - Éxito: `createUser` y luego `insert` en `perfiles` con `fraccionamiento_id` del admin.
  - Email duplicado → `email_duplicado` sin `insert` (Review Focus 3).
  - Falla el insert → se llama `deleteUser(id)` y devuelve `error` (Review Focus 4).
  - Falla el insert y también `deleteUser` → `console.error` llamado, devuelve `error`.
  - `crearUsuario` con `rol: 'super_admin'` → falla validación sin tocar el cliente admin.
- [ ] **Step 3: Correr** → FAIL (`supabase test db` y `npm test`).
- [ ] **Step 4: Implementar** migración, cliente admin, `altaUsuario` y `crearUsuario`. Eliminar `invokeEdgeFunction(…, 'create-user', …)`.
- [ ] **Step 5: Verificar:** `supabase db reset </dev/null && supabase test db </dev/null` + los cuatro comandos de npm → verde.
- [ ] **Step 6: Listo para commit.**

---

### Task 4: Nombre del fraccionamiento en la interfaz

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/brand-logo.tsx`, `src/components/layout/{sidebar,sidebar-content,app-bar}.tsx` (+ tests), las 8 páginas con "Lago Amadeo" en `description` (`(app)/page.tsx`, `domicilios`, `residentes`, `cuotas`, `pagos`, `movimientos`, `reportes`, `usuarios`), `src/features/domicilios/components/domicilio-info-card.tsx` (+ test), `src/features/movimientos/export/generar.ts` y su llamador.

**Interfaces:**
- Consumes: `getTenantContext()` (tarea 2), `PRODUCTO` (tarea 1).
- Produces:
  - `ShellUser = { userName: string; roleName: RoleName | null; fraccionamientoNombre: string }`.
  - `BrandLogo` muestra `PRODUCTO` y, si recibe `subtitulo`, el nombre del fraccionamiento debajo.
  - Metadata:
    - `src/app/layout.tsx`: `title: PRODUCTO`, `description: 'Administración de fraccionamientos'`.
    - `(app)/layout.tsx`: `generateMetadata` devuelve `title: '<nombre del fraccionamiento> · ' + PRODUCTO`.
  - Descripciones de página: "Lago Amadeo" se quita.
    - Inicio: "Resumen general del fraccionamiento."
    - Domicilios: "Gestiona los domicilios del fraccionamiento."
    - Residentes: "Consulta los residentes del fraccionamiento."
    - Cuotas: "Gestiona las cuotas de mantenimiento del fraccionamiento."
    - Pagos: "Consulta y administra los pagos del fraccionamiento."
    - Movimientos: "Consulta y administra todos los movimientos financieros del fraccionamiento."
    - Reportes: "Consulta y genera reportes del fraccionamiento."
    - Usuarios: "Gestiona los usuarios del fraccionamiento."
  - `domicilio-info-card`: "Domicilio del fraccionamiento."
  - `generar.ts`: recibe `fraccionamientoNombre: string` y el título del PDF es `` `Movimientos financieros · ${fraccionamientoNombre}` ``.

- [ ] **Step 1: Pruebas:**
  - `sidebar-content.test.tsx`: muestra `Fraccionamientos` y `Fracc Demo` cuando `fraccionamientoNombre = 'Fracc Demo'`.
  - `app-bar`: muestra el nombre del fraccionamiento.
  - `domicilio-info-card.test.tsx`: texto nuevo.
  - `generar` (o su test existente): el título incluye el nombre recibido.
  - `grep -rn "Lago Amadeo" src` vacío fuera de tests de datos de ejemplo (direcciones `LAGO …` se quedan).
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 5: Fraccionamiento de demostración local y verificación final

**Files:**
- Create: `supabase/scripts/demo-local.sql`
- Modify: `README.md`

**Interfaces:**
- Produces: un script idempotente, que se corre con `psql postgresql://postgres:postgres@127.0.0.1:55322/postgres -f supabase/scripts/demo-local.sql`. Crea:
  - El fraccionamiento `Fracc Demo` (slug `fracc-demo`).
  - Un administrador `admin.demo@local.test` / `admin12345` y un tesorero `tesorero.demo@local.test` / `tesorero12345`, con el mismo patrón de `auth.users` + `auth.identities` + `perfiles` que `seed.sql`.
  - Un tipo de cuota `Mensual` de 500 (`tipo_pago_id = 1`), con acceso por teléfono y por tarjeta.
  - Si ya existen, no duplica nada (`on conflict do nothing` o comprobación previa).

- [ ] **Step 1: Escribir el script y correrlo dos veces** → la segunda vez no cambia nada (contar filas antes y después).
- [ ] **Step 2: Verificar el inicio de sesión** de `admin.demo@local.test` con el `curl` de `README.md` → `access_token`.
- [ ] **Step 3: Verificación completa:**
  - `supabase db reset </dev/null && supabase test db </dev/null` → PASS.
  - `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → verde.
  - `grep -rn "create-user\|from('users')\|from('user_roles')\|from('roles')" src` → vacío.
- [ ] **Step 4: `README.md`.** Explicar cómo cargar la demo y las cuentas locales: super admin, admin y tesorero de la demo. Anotar que los recibos y las exportaciones están pendientes de la fase 4.
- [ ] **Step 5: Listo para commit.**

---

## Resultado y pendientes (2026-11-10)

Fase 2 terminada: 418 pruebas de Vitest y 688 de pgTAP en verde; `tsc`, lint y build limpios. La app corre sobre el esquema multi-tenant con la demo local (`supabase/scripts/demo-local.sql`).

Ajustes durante la ejecución:
- ESLint ignora `.agents/**`, `.claude/**` y `supabase/.temp/**`.
- Email duplicado solo con `code === 'email_exists'` (o 422 sin código); una contraseña débil ya no se reporta como duplicado.
- Las acciones de domicilios, residentes y accesos exigen rol administrador (antes devolvían éxito falso a otros roles).
- El email del alta se guarda en minúsculas; el script de demo se niega a correr si no encuentra el super admin local.

Pendientes aceptados (UX, sin fuga de datos):
1. El layout no se reevalúa en navegación del lado del cliente: un usuario desactivado ve páginas vacías y "Tu sesión expiró" hasta recargar. Opción barata: un helper `requireAppAccess()` en cada página de `(app)`.
2. Ocultar a los no administradores los botones de domicilios, residentes y accesos (`puedeAdministrar`, como `puedeGestionar`); `hasRole` no considera `isActive`.
3. Vigilancia ve en el menú Pagos, Movimientos, Reportes e Inicio, que RLS le muestra vacíos.
4. `/sin-acceso` debería redirigir a quien sí tiene acceso; quitar el código muerto de `reason=inactive`; el cierre de sesión es GET.

Para la fase 3 (consola `/admin`):
- Proteger cada página y acción de `/admin` por sí misma, no solo con el layout.
- Altas del super admin con `altaUsuario(createAdminClient(), …)`; `generar_cuotas` rechaza al super admin.

Para la fase 4 (recibos, exportaciones y nube):
- Recibos (`generar-recibo-b64`) y exportaciones (`create-zkteco-txt`, `create-eldesgate-csv`) siguen llamando edge functions que no existen en el proyecto nuevo.
- Las exportaciones deben exigir un rol con lectura de accesos.
- Tras `db push`, confirmar que `anon` no tenga permisos y que los permisos de columna de `perfiles` se mantengan.
