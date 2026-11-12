# Multi-tenant, fase 3 (consola del super admin): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El super admin administra los fraccionamientos desde `/admin`: los crea y edita, da de alta y desactiva a sus usuarios y captura sus catálogos iniciales. Además, se desactivan las exportaciones ZKTeco y Eldesgate.

**Architecture:** Cada página y Server Action de `/admin` verifica por sí misma que el usuario sea super admin; el layout no basta en Next 16. Las escrituras del super admin usan el cliente con su sesión, porque RLS ya le permite escribir con `fraccionamiento_id` explícito. La excepción es el alta de usuarios, que usa `altaUsuario(createAdminClient(), …)` de la fase 2. La consola reutiliza los componentes de Configuración y Usuarios: estos reciben la Server Action como prop, con la acción actual como valor por defecto.

**Tech Stack:** Next.js 16.3 (App Router), React 19.2, `@supabase/ssr` + `supabase-js`, Zod 4, react-hook-form, shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-multitenant-design.md` (§3 "Consola del super admin" y "Exportaciones"). Notas de entrada: final de `docs/superpowers/plans/2026-11-10-multitenant-fase2-app.md`.

## Global Constraints

- **No hacer commits.** El usuario hace todos los commits.
- **Next.js 16 no es el que conoces.** Leer la guía relevante en `node_modules/next/dist/docs/` antes de escribir código de Next (AGENTS.md). Las Server Actions con `.bind(null, id)` se pueden pasar como props a componentes cliente.
- **No levantar el servidor.** Validar con `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build`; los cuatro deben pasar al cerrar cada tarea. Si hay cambios de base, también `supabase db reset </dev/null && supabase test db </dev/null`. Todos los comandos `supabase` llevan `</dev/null`.
- **No modificar migraciones existentes.** Esta fase no necesita cambios de esquema.
- **Autorización:** toda página de `/admin` llama a `requireSuperAdminPage()` y toda Server Action de la consola usa `runSuperAdminAction`. Ningún cliente de la app recibe `fraccionamiento_id` de un usuario que no sea super admin.
- **Service role:** solo en el alta de usuarios (`createAdminClient`), como en la fase 2.
- **Textos en español**, sentence case, con los componentes y estilos actuales (`PageHeader`, `SectionCard`, `DataTable`, `FormDialog`, `StatusBadge`, `EmptyState`).
- **TDD:** la prueba primero.

## Decisiones tomadas en este plan

1. **Ruta de detalle:** `/admin/fraccionamientos/[id]?tab=usuarios|cuotas|extras|descuentos|recargos`. Usuarios es la pestaña por defecto; las demás son los catálogos.
2. **Usuarios desde la consola:** crear, activar y desactivar. Editar nombre o rol queda para el Administrador del fraccionamiento, porque el spec solo pide "crea y desactiva".
3. **Reutilización por props:** `AddUserDialog`, `UsuariosView`, `CatalogoSection` y `TiposCuotaSection` (y sus diálogos) aceptan props opcionales con la Server Action a usar. Sin props, se comportan exactamente como hoy.
4. **Exportaciones:** se eliminan las rutas, el proxy, los botones y los esquemas de ZKTeco y Eldesgate. Las tablas de "Acceso vehicular" y "Acceso peatonal" en Reportes se conservan. `invokeEdgeFunction` se queda, porque lo usan los recibos (fase 4).

## Review Focus

1. **Un Administrador de fraccionamiento llama directamente a una acción de la consola** (por ejemplo `crearUsuarioEnFraccionamiento(idDeOtro, …)`). Responde `MSG_NO_PERMISO` y nunca crea el cliente con service role. Prueba en la tarea 4.
2. **Slug con mayúsculas, acentos o espacios, o repetido.** El slug sugerido se normaliza ("Lomas del Río" → `lomas-del-rio`); uno inválido se rechaza con un mensaje claro; uno repetido responde "Ya existe un fraccionamiento con ese slug." Prueba en la tarea 2.
3. **ID de instalación con formato inválido o ya asignado a otro fraccionamiento.** Mensajes claros; vacío se guarda como null. Prueba en la tarea 2.
4. **Un catálogo con un nombre que ya existe en otro fraccionamiento.** Se permite; la comprobación de duplicados es solo dentro del fraccionamiento. Prueba en la tarea 5.
5. **Abrir `/admin/fraccionamientos/999` (no existe) o con id no numérico.** Responde 404, sin error 500. Prueba en la tarea 4.

---

### Task 1: Desactivar las exportaciones ZKTeco y Eldesgate

**Files:**
- Delete: `src/app/api/exports/zkteco/route.ts` (+ test), `src/app/api/exports/eldesgate/route.ts` (+ test), `src/features/reportes/export-proxy.ts`, `src/features/reportes/components/inicio-id-export.tsx`, `src/features/reportes/components/salida-export.tsx`
- Modify: `src/features/reportes/schemas.ts` (+ test): quitar `eldesgateParamsSchema` y `zktecoParamsSchema`; `src/features/reportes/components/acceso-vehicular-tab.tsx` y `acceso-peatonal-tab.tsx`: quitar la prop `extra` con los botones de exportación; `README.md`: quitar o actualizar menciones a las exportaciones.

**Interfaces:**
- Produces: nada nuevo. Las pestañas de accesos siguen mostrando sus tablas.

- [ ] **Step 1: Pruebas.** Si las pestañas de accesos tienen pruebas, agregar una aserción de que no hay botón de exportar (`queryByRole('button', { name: /exportar/i })` es null). Si no tienen, agregar una prueba de render mínima para `AccesoVehicularTab` o `AccesoPeatonalTab` con filas de ejemplo que lo verifique.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Eliminar y ajustar.** `grep -rni "zkteco\|eldesgate\|exports/\|export-proxy" src README.md` debe quedar vacío (salvo `database.types.ts`, si aparece).
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 2: Autorización del super admin y capa de datos de fraccionamientos

**Files:**
- Modify: `src/lib/auth/require-role.ts`, `src/lib/auth/run-action.ts` (+ tests)
- Create: `src/lib/auth/require-super-admin-page.ts` (+ test)
- Create: `src/features/fraccionamientos/{schemas,slug,queries,actions,messages}.ts` (+ tests `schemas.test.ts`, `slug.test.ts`, `queries.test.ts`, `actions.test.ts`)

**Interfaces:**
- Consumes: `getTenantContext()`, `estadoAcceso()` de `src/lib/auth/tenant-context.ts`; `AuthorizationError` de `require-role.ts`; `MSG_SESION`, `MSG_NO_PERMISO`, `MSG_ERROR` de `run-action.ts`.
- Produces:
  - `require-role.ts`: `export async function requireSuperAdmin(): Promise<{ id: string; email: string }>`. Sin contexto lanza `AuthorizationError('NO_SESSION')`; con contexto que no es `super_admin` lanza `AuthorizationError('FORBIDDEN')`.
  - `run-action.ts`: `export async function runSuperAdminAction<T>(fn: (admin: { id: string; email: string }) => Promise<ActionResult<T>>): Promise<ActionResult<T>>`. Tiene el mismo manejo de errores que `runAction`.
  - `require-super-admin-page.ts`: `export async function requireSuperAdminPage(): Promise<void>`. Llama a `notFound()` si no es super admin.
  - `slug.ts`: `export function slugify(nombre: string): string`. Minúsculas, sin acentos (NFD), todo lo que no sea `[a-z0-9]` se convierte en `-`, guiones colapsados y sin guiones al inicio ni al final.
  - `schemas.ts`: `fraccionamientoSchema = z.object({ nombre, slug, instalacionId, activo })`, con:
    - `nombre`: recortado, de 1 a 80 caracteres, mensaje "El nombre es obligatorio".
    - `slug`: recortado, de 1 a 60 caracteres, debe cumplir `^[a-z0-9]+(-[a-z0-9]+)*$`, mensaje "Usa minúsculas, números y guiones".
    - `instalacionId`: texto recortado; vacío → `null`; si no, UUID, mensaje "ID de instalación inválido".
    - `activo`: boolean.

    Tipos exportados: `FraccionamientoInput` (input) y `FraccionamientoDatos` (output).
  - `queries.ts`:
    - `export type FraccionamientoResumen = { id: number; nombre: string; slug: string; activo: boolean; instalacionId: string | null; usuarios: number; domicilios: number }`
    - `export async function listFraccionamientos(supabase): Promise<FraccionamientoResumen[]>`. Usa `select('id, nombre, slug, activo, instalacion_id, perfiles(count), domicilios(count)')` y ordena por `nombre`.
    - `export async function getFraccionamiento(supabase, id: number): Promise<FraccionamientoResumen | null>`
  - `messages.ts`:
    - `MSG_SLUG_DUPLICADO = 'Ya existe un fraccionamiento con ese slug.'`
    - `MSG_INSTALACION_DUPLICADA = 'Esa instalación ya está asignada a otro fraccionamiento.'`
    - `MSG_FRACCIONAMIENTO_NO_EXISTE = 'El fraccionamiento ya no existe. Recarga la página.'`
  - `actions.ts`:
    - `crearFraccionamiento(input: FraccionamientoInput): Promise<ActionResult<{ id: number }>>`
    - `actualizarFraccionamiento(id: number, input: FraccionamientoInput): Promise<ActionResult>`

    Ambas con `runSuperAdminAction` y el cliente de sesión, y `revalidatePath('/admin')`. Un 23505 se mapea a `MSG_SLUG_DUPLICADO` si el mensaje o la restricción menciona `slug`, y a `MSG_INSTALACION_DUPLICADA` si menciona `instalacion`. Una actualización que afecta 0 filas responde `MSG_FRACCIONAMIENTO_NO_EXISTE`.

- [ ] **Step 1: Pruebas:**
  - `slugify('Lomas del Río')` = `'lomas-del-rio'`; `slugify('  Fracc. Ñandú  #2 ')` = `'fracc-nandu-2'` (Review Focus 2).
  - Esquema: slug `'Lomas'` inválido con el mensaje exacto; `instalacionId: ''` → `null`; `instalacionId: 'abc'` → "ID de instalación inválido" (Review Focus 3).
  - `runSuperAdminAction`: administrador → `MSG_NO_PERMISO`, sin llamar `fn`; sin sesión → `MSG_SESION`; super admin → ejecuta `fn`.
  - `requireSuperAdminPage`: tesorero → `notFound()`.
  - Acciones: insert/update con `{ nombre, slug, instalacion_id, activo }`; 23505 de slug → `MSG_SLUG_DUPLICADO`; 23505 de instalación → `MSG_INSTALACION_DUPLICADA`; update con 0 filas → `MSG_FRACCIONAMIENTO_NO_EXISTE`; administrador → `MSG_NO_PERMISO`.
  - `listFraccionamientos` mapea los conteos `[{ count: n }]` a números.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 3: Lista de fraccionamientos y diálogo de alta y edición

**Files:**
- Modify: `src/app/admin/layout.tsx` (+ test), `src/app/admin/page.tsx` (+ test)
- Create: `src/features/fraccionamientos/components/{fraccionamientos-table,fraccionamiento-dialog}.tsx` (+ tests)
- Modify: `README.md` (sección de la consola)

**Interfaces:**
- Consumes: tarea 2 (`listFraccionamientos`, `crearFraccionamiento`, `actualizarFraccionamiento`, `fraccionamientoSchema`, `slugify`, `requireSuperAdminPage`).
- Produces:
  - `admin/layout.tsx`: además del encabezado actual, un menú con un único enlace "Fraccionamientos" → `/admin`.
  - `admin/page.tsx`: llama a `requireSuperAdminPage()`. Muestra un `PageHeader` con el título "Fraccionamientos", la descripción "Crea y administra los fraccionamientos de la plataforma." y la acción "+ Nuevo fraccionamiento".
  - `FraccionamientosTable({ rows })`:
    - Columnas: Nombre (enlace a `/admin/fraccionamientos/<id>`), Slug, Estado (`StatusBadge` "Activo" o "Inactivo"), Usuarios, Domicilios y Acciones (lápiz con `aria-label="Editar <nombre>"`).
    - Si no hay filas, `EmptyState` con el texto "Aún no hay fraccionamientos.".
  - `FraccionamientoDialog({ item?, trigger })`:
    - Campos: Nombre*, Slug*, ID de instalación (opcional; ayuda: "Instalación de control de acceso. Puedes dejarlo vacío.") y Activo (switch, encendido al crear).
    - Mientras el usuario no edite el slug a mano, este se rellena con `slugify(nombre)`. Al editar un fraccionamiento existente, el slug no se reescribe solo.
    - Al guardar, `toast` de éxito y se cierra; con error, el mensaje de la acción.

- [ ] **Step 1: Pruebas:**
  - La tabla muestra las columnas y los conteos.
  - Diálogo: escribir "Lomas del Río" rellena el slug `lomas-del-rio`. Después de editar el slug a mano, cambiar el nombre ya no lo sobrescribe.
  - El diálogo envía `{ nombre, slug, instalacionId: '', activo: true }` a `crearFraccionamiento`; con `item`, llama a `actualizarFraccionamiento(item.id, …)`.
  - `admin/page`: un tesorero recibe `notFound()`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 4: Detalle del fraccionamiento: usuarios

**Files:**
- Create: `src/app/admin/fraccionamientos/[id]/page.tsx` (+ test), `src/features/fraccionamientos/components/fraccionamiento-tabs.tsx`
- Create: `src/features/fraccionamientos/usuarios-actions.ts` (+ test)
- Modify: `src/features/usuarios/components/{add-user-dialog,usuarios-view,usuarios-table,usuario-actions}.tsx` (+ tests): props opcionales.
- Modify: `src/features/usuarios/queries.ts`: `listUsuarios` acepta un `fraccionamientoId` opcional.

**Interfaces:**
- Consumes:
  - `altaUsuario`, `createAdminClient` y `nuevoUsuarioSchema` (fase 2).
  - `runSuperAdminAction`, `requireSuperAdminPage` y `getFraccionamiento` (tarea 2).
- Produces:
  - `usuarios-actions.ts` (`'use server'`):
    - `crearUsuarioEnFraccionamiento(fraccionamientoId: number, input: NuevoUsuarioInput): Promise<ActionResult>`. Con `runSuperAdminAction`: valida el esquema, comprueba con `getFraccionamiento` que el fraccionamiento existe (si no, `MSG_FRACCIONAMIENTO_NO_EXISTE`) y llama a `altaUsuario(createAdminClient(), { fraccionamientoId, … })`. Los mensajes son los mismos que en la fase 2. Al terminar, `revalidatePath('/admin/fraccionamientos/<id>')`.
    - `cambiarEstadoUsuarioEnFraccionamiento(fraccionamientoId: number, usuarioId: string, activo: boolean): Promise<ActionResult>`. Con `runSuperAdminAction`, hace `update` en `perfiles` con `{ activo }`, filtrado por `id` y `fraccionamiento_id`. Si afecta 0 filas, responde "El usuario ya no existe. Recarga la página.".
  - `listUsuarios(supabase, activos, fraccionamientoId?: number)`: si recibe el id, agrega `.eq('fraccionamiento_id', id)`.
  - Props nuevas, opcionales; sin ellas, el comportamiento es el de hoy:
    - `AddUserDialog({ crear?: (input: NuevoUsuarioInput) => Promise<ActionResult> })`
    - `UsuariosView` y `UsuariosTable`: `{ cambiarEstado?: (id: string, activo: boolean) => Promise<ActionResult>; permitirEditar?: boolean }`. `permitirEditar` es `true` por defecto; en la consola es `false` y oculta el lápiz de edición.
  - `FraccionamientoTabs({ id, tab, children })`: pestañas en la URL con `usuarios | cuotas | extras | descuentos | recargos`. Las etiquetas de catálogos vienen de `CATALOGOS[t].tab`, y la de usuarios es "Usuarios".
  - Página de detalle:
    - Llama a `requireSuperAdminPage()`. Un id no numérico o inexistente responde `notFound()` (Review Focus 5).
    - `PageHeader` con título = nombre del fraccionamiento, breadcrumbs `Fraccionamientos` → nombre, y como acciones el botón de editar (`FraccionamientoDialog`) y, en la pestaña Usuarios, "+ Nuevo usuario".
    - En la pestaña Usuarios, `UsuariosView` con `listUsuarios(supabase, activos, id)`, `cambiarEstado = cambiarEstadoUsuarioEnFraccionamiento.bind(null, id)` y `permitirEditar = false`. `AddUserDialog` recibe `crear = crearUsuarioEnFraccionamiento.bind(null, id)`.
    - Las pestañas de catálogos quedan con un marcador hasta la tarea 5.

- [ ] **Step 1: Pruebas:**
  - Acciones: un administrador → `MSG_NO_PERMISO` sin llamar `createAdminClient` (Review Focus 1); el super admin crea con el `fraccionamiento_id` del parámetro; si el fraccionamiento no existe → `MSG_FRACCIONAMIENTO_NO_EXISTE`; email duplicado → `MSG_EMAIL_DUPLICADO`.
  - `cambiarEstadoUsuarioEnFraccionamiento`: filtra por `id` y `fraccionamiento_id`; con 0 filas devuelve el mensaje exacto.
  - Componentes: con la prop `crear`, el diálogo llama a esa función y no a `crearUsuario`; con `permitirEditar=false` no hay botón "Editar …".
  - Página: id `'abc'` → `notFound()`; `getFraccionamiento` null → `notFound()`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 5: Detalle del fraccionamiento: catálogos

**Files:**
- Modify: `src/features/catalogos/actions.ts` (+ test), `src/features/catalogos/queries.ts` (+ test), `src/features/cuotas/queries.ts` (`listConceptosDescuento`, `listConceptosRecargo`), `src/features/catalogos/components/{catalogo-section,catalogo-dialog,tipos-cuota-section,tipo-cuota-dialog}.tsx` (+ tests)
- Modify: `src/app/admin/fraccionamientos/[id]/page.tsx` (+ test)

**Interfaces:**
- Consumes: `runSuperAdminAction` (tarea 2); `FraccionamientoTabs` y la página de detalle (tarea 4).
- Produces:
  - En `catalogos/actions.ts`:
    - `guardarCatalogoEnFraccionamiento(fraccionamientoId: number, catalogo: CatalogoSimple, id: number | null, input: CatalogoInput): Promise<ActionResult>`
    - `guardarTipoCuotaEnFraccionamiento(fraccionamientoId: number, id: number | null, input: TipoCuotaInput): Promise<ActionResult>`

    Ambas con `runSuperAdminAction` y la misma lógica que `guardarCatalogo` y `guardarTipoCuota`, con un `fraccionamientoId` interno:
    - La búsqueda de duplicados filtra `.eq('fraccionamiento_id', id)` (Review Focus 4).
    - El insert incluye `fraccionamiento_id`, también en `concepto_pago_acceso`.
    - El update filtra por `fraccionamiento_id`.

    Las acciones actuales no cambian su firma ni su comportamiento: pasan `null` y siguen sin filtro, porque RLS ya limita al fraccionamiento del administrador. Revalidan `/admin/fraccionamientos/<id>`.
  - Las queries de catálogos (`listTiposCuota`, `listConceptosExtraCatalogo`, `listConceptosDescuento`, `listConceptosRecargo`) aceptan un `fraccionamientoId?: number` final que agrega `.eq('fraccionamiento_id', id)`. Sin él, la consulta es la de hoy.
  - Props opcionales, con la acción actual como valor por defecto:
    - `CatalogoSection` y `CatalogoDialog`: `guardar?: (catalogo, id, input) => Promise<ActionResult>`
    - `TiposCuotaSection` y `TipoCuotaDialog`: `guardar?: (id, input) => Promise<ActionResult>`
  - La página de detalle renderiza cada pestaña de catálogo con las queries filtradas por el id y con `guardar` ligado mediante `.bind(null, id)`.

- [ ] **Step 1: Pruebas:**
  - Con `fraccionamientoId = 7`: insert con `fraccionamiento_id: 7`, búsqueda de duplicados con `eq('fraccionamiento_id', 7)`; si ya existe "Mensual" en otro fraccionamiento, se acepta; en el mismo, `MSG_NOMBRE_DUPLICADO`.
  - Tipo de cuota con id 7: también inserta `concepto_pago_acceso` con `fraccionamiento_id: 7`.
  - Las acciones de consola con un administrador → `MSG_NO_PERMISO`.
  - Las acciones actuales siguen pasando sus pruebas sin cambios.
  - Componentes: con la prop `guardar`, el diálogo la usa.
  - Página: la pestaña `descuentos` llama a `listConceptosDescuento(supabase, id)`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificación final:**
  - `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → verde.
  - `supabase test db </dev/null` → PASS.
  - Prueba de base real como super admin, dentro de `begin; … rollback;` con `psql` en el contenedor: con `request.jwt.claims` del super admin del seed y `set local role authenticated`, insertar en `conceptos_descuento` con el `fraccionamiento_id` de "Fracc Demo" → 1 fila.
- [ ] **Step 5: Listo para commit.**

---

## Resultado y pendientes (2026-11-10)

Fase 3 terminada: 505 pruebas de Vitest y 688 de pgTAP en verde, con y sin la demo cargada; `tsc`, lint y build limpios.

Ajustes durante la ejecución:
- Un slug repetido que contiene "instalacion" ya no se reporta como instalación duplicada: el error se clasifica por el nombre de la restricción.
- Las pruebas pgTAP del super admin cuentan solo los fraccionamientos de prueba, así que pasan aunque la demo esté cargada.
- README: título genérico, sección de la consola, roles alineados al spec y enlaces a los documentos multi-tenant.

Pendientes (pueden esperar):
1. README: "Limitaciones conocidas" todavía dice que el RLS es permisivo y que el esquema no se modifica.
2. El conteo de usuarios de la lista incluye inactivos.
3. El super admin puede desactivar al último administrador de un fraccionamiento (puede reactivarlo).
4. El filtro de estado de usuarios en la consola pierde `?tab` (inofensivo: la pestaña por defecto es Usuarios).
5. `PeriodoReporteFiltros` conserva una prop `extra` sin uso; el cambio de pestaña y el mapeo de montos se repiten entre Configuración y la consola.
6. Alta de tipo de cuota y compensación del alta de usuarios sin transacción en la base.

Para la fase 4 (recibos y nube):
- Recibos: `src/features/pagos/recibo.ts` todavía llama a la edge function `generar-recibo-b64`; al reemplazarla, borrar `src/lib/supabase/functions.ts` y su prueba.
- Nube: `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor; `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` si hay varias instancias; desactivar el registro libre; crear el primer super admin; revisar permisos de `anon` y de `perfiles` tras `db push`.
