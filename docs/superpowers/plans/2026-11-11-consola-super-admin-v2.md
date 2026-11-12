# Consola del super admin v2: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El super admin opera la plataforma con el mismo menú lateral que los fraccionamientos: un inicio con métricas, fraccionamientos con sus usuarios, domicilios, residentes, accesos y reportes de acceso, y nada financiero, con el bloqueo aplicado también en la base.

**Architecture:**
- Una migración ajusta las políticas del super admin y agrega `reporte_accesos_admin` (`security definer`, con comprobación de super admin).
- El esqueleto `Sidebar`/`AppBar` se comparte entre `(app)` y `/admin` con una variante de menú.
- Las pantallas de consola reutilizan los componentes de domicilios, residentes, accesos y reportes, que reciben sus Server Actions por props.
- Las acciones de consola usan `runSuperAdminAction` con `fraccionamiento_id` explícito.

**Tech Stack:** Next.js 16.3, React 19.2, Supabase (RLS + pgTAP), Zod 4, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-consola-super-admin-v2-design.md` (aprobado).

## Global Constraints

- **No hacer commits.** El usuario hace todos los commits. Nunca `git add`/`git rm`: borrar archivos con `rm`.
- **Next.js 16:** leer `node_modules/next/dist/docs/` antes de escribir código de Next (AGENTS.md). Las Server Actions ligadas con `.bind(null, id)` se pueden pasar como props, también dentro de un objeto. No levantar el servidor.
- **Comprobaciones al cerrar cada tarea:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Con cambios de base, además:
  - `supabase db reset </dev/null && supabase test db </dev/null`;
  - recargar la demo con `docker exec -i supabase_db_app-fraccionamientos psql -U postgres -v ON_ERROR_STOP=1 < supabase/scripts/demo-local.sql`.

  Todos los comandos `supabase` llevan `</dev/null`.
- **No modificar migraciones existentes:** los cambios de esquema van en una migración nueva con pruebas pgTAP; los tipos se regeneran con `supabase gen types typescript --local > src/lib/supabase/database.types.ts </dev/null`.
- **Autorización:**
  - Toda página de `/admin` llama a `requireSuperAdminPage()` y toda acción de consola usa `runSuperAdminAction`.
  - Las acciones de consola filtran por `fraccionamiento_id` y lo incluyen al insertar.
  - Nunca se usa la service role, salvo en el alta de usuarios que ya existe.
- **Sin dinero en la consola:** ninguna pantalla de `/admin` muestra montos ni estados de pago ("Al corriente", "Moroso", "Pagado"). No se monta `CuotasSection` ni `PagosExtraSection`, ni se selecciona `domicilios_info.estatus`.
- **Comportamiento del administrador intacto:** las acciones y componentes actuales, sin las props nuevas, se comportan exactamente igual que hoy. Sus pruebas existentes siguen pasando sin cambios de intención.
- **Textos en español**, sentence case, con los componentes y tokens WEADMI existentes. TDD.

## Review Focus

1. **Un administrador llama directamente una acción de consola** con un `fraccionamientoId` ajeno. Debe recibir `MSG_NO_PERMISO` sin tocar la base. Prueba en la tarea 4.
2. **El super admin consulta `pagos` o `cuotas` por la API.** Debe obtener 0 filas, y cualquier escritura debe fallar con 42501. Prueba en la tarea 1.
3. **Domicilio de otro fraccionamiento en la URL de la consola** (`/admin/fraccionamientos/A/domicilios/<id de B>`). Debe responder 404. Prueba en la tarea 5.
4. **Fraccionamiento sin tipos de cuota.** El botón "Nuevo domicilio" debe aparecer deshabilitado con el aviso exacto. Prueba en la tarea 5.
5. **Teléfonos o tarjetas al límite** (`LIMITES`). La acción de consola debe rechazar uno más con el mismo mensaje que la del administrador. Prueba en la tarea 4.

---

### Task 1: Permisos del super admin y reporte de accesos en la base

**Files:**
- Create: `supabase/migrations/<ts>_super_admin_permisos.sql` (con `supabase migration new super_admin_permisos </dev/null`), `supabase/tests/database/065-super-admin.test.sql`
- Modify: `supabase/tests/database/040-rls-negocio.test.sql`, y `020` si alguna prueba de catálogos del super admin vive ahí; `src/lib/supabase/database.types.ts` (regenerado)

**Interfaces:**
- Produces:
  - **Políticas:** se recrean (`drop policy` + `create policy`, con los mismos nombres `<tabla>_<cmd>`) para que el super admin tenga exactamente la tabla de permisos de la spec §1. El resto de cada política (roles del fraccionamiento) queda igual.
    - Lectura sí: `domicilios`, `domicilio_concepto`, `residentes`, `telefonos_acceso`, `tarjetas_acceso`, `conceptos_pago`, `concepto_pago_acceso`.
    - Escritura sí:
      - `domicilios`: insert y update;
      - `domicilio_concepto`: solo insert;
      - `residentes`, `telefonos_acceso` y `tarjetas_acceso`: insert, update y delete.
    - Sin ningún acceso: `conceptos_descuento`, `conceptos_recargo`, `cuotas`, `descuento_cuota`, `recargo_cuota`, `pagos`, `movimientos_financieros`.
  - **Función** `public.reporte_accesos_admin(p_fraccionamiento_id bigint, p_anio int, p_mes int, p_tipo text)`:
    - Devuelve `table(cuota_id bigint, domicilio_id bigint, direccion text, anio bigint, mes bigint, valor_1 text, valor_2 text, valor_3 text)`.
      - Con `p_tipo = 'telefono'`: `valor_1` y `valor_2` son `telefono_1` y `telefono_2`, y `valor_3` es null.
      - Con `p_tipo = 'tarjeta'`: son `tarjeta_1..3`.
      - Cualquier otro `p_tipo` → excepción con errcode `22023`.
    - Es `language plpgsql`, `stable`, `security definer` y con `set search_path = ''`.
    - Lo primero que hace es `if not (select private.es_super_admin()) then raise exception 'No autorizado' using errcode = '42501'; end if;`.
    - La lógica es la de `accesos_telefono_info` y `accesos_tarjeta_info` (en `20261110063329_vistas.sql`), más los filtros `c.fraccionamiento_id = p_fraccionamiento_id and c.anio = p_anio and c.mes = p_mes`.
    - `revoke execute … from public, anon; grant execute … to authenticated, service_role;`.

- [ ] **Step 1: Pruebas.**
  - `040`: la matriz de expectativas del super admin cambia según la lista anterior. Ejemplos: `super` lee 2 filas en `domicilios` y 0 en `pagos`; insertar en `pagos` da `'42501'`; actualizar `domicilio_concepto` afecta 0 filas o da `'42501'` (anotar cuál).
  - La prueba de la fase 3 "super crea catálogos iniciales" ahora espera `'42501'` al insertar en `conceptos_pago`.
  - `065-super-admin.test.sql`:
    - `reporte_accesos_admin(fid('fracc-a'), 2026, 1, 'tarjeta')`: con la cuota de A marcada como pagada (`estatus_id = 2`, dentro de la transacción), como `super` devuelve 1 fila con la dirección de A, y nunca filas de B.
    - Como `admin.a`, la misma llamada → `throws_ok(…, '42501')`.
    - `p_tipo = 'otro'` → `'22023'`.
    - Como `super`: `select count(*) from pagos` = 0 y `select count(*) from cuotas` = 0 (Review Focus 2).
- [ ] **Step 2: Correr** `supabase db reset </dev/null && supabase test db </dev/null` → FAIL.
- [ ] **Step 3: Implementar** la migración y regenerar los tipos.
- [ ] **Step 4: Verificar:** pgTAP → PASS; los cuatro comandos de npm → verde. Recargar la demo.
- [ ] **Step 5: Listo para commit.**

---

### Task 2: Esqueleto con menú lateral, rutas y limpieza de catálogos en consola

**Files:**
- Modify: `src/components/layout/{nav-items,nav-list,sidebar,sidebar-content,app-bar,mobile-nav}.ts(x)` (+ tests), `src/app/admin/layout.tsx` (+ test), `src/app/admin/page.tsx` (+ test)
- Create: `src/app/admin/fraccionamientos/page.tsx` (+ test), con la lista que hoy está en `/admin`
- Modify: `src/app/admin/fraccionamientos/[id]/page.tsx` (+ test), `src/features/fraccionamientos/tabs.ts`, `src/features/fraccionamientos/components/fraccionamiento-tabs.tsx`
- Modify (limpieza): `src/features/catalogos/actions.ts` (+ test): eliminar `guardarCatalogoEnFraccionamiento`, `guardarTipoCuotaEnFraccionamiento` y sus pruebas. Los parámetros opcionales de las queries y componentes de catálogos se pueden conservar.

**Interfaces:**
- Produces:
  - `ShellUser` agrega `variante: 'fraccionamiento' | 'plataforma'`. Es serializable y se pasa desde los layouts.
  - `nav-items.ts`:
    - exporta `ADMIN_NAV_ITEMS: NavItem[]` = `[{ label: 'Inicio', href: '/admin', icon: Home }, { label: 'Fraccionamientos', href: '/admin/fraccionamientos', icon: Building2 }]`;
    - `navItemsPara(variante, roleName)` devuelve `ADMIN_NAV_ITEMS` para `'plataforma'` y `visibleNavItems(roleName)` para `'fraccionamiento'`.

    En el menú de consola, Inicio solo está activo con `pathname === '/admin'` exacto; Fraccionamientos, con el prefijo `/admin/fraccionamientos`.
  - En la variante `'plataforma'`, `SidebarContent` y `AppBar` muestran el subtítulo "Consola de plataforma" (en lugar del nombre del fraccionamiento) y el rol "Super admin".
  - `admin/layout.tsx` usa `Sidebar`, `AppBar` y el menú móvil igual que `(app)/layout.tsx`, con `variante: 'plataforma'` y el nombre del perfil del super admin. Sigue llamando a `requireSuperAdminPage()`.
  - `admin/page.tsx` queda como página de Inicio, con un `PageHeader` "Inicio" y "Resumen de la plataforma." La tarea 3 llena las métricas.
  - `/admin/fraccionamientos` contiene la lista y el diálogo de la fase 3, con el mismo `PageHeader` "Fraccionamientos". Los enlaces de la tabla siguen apuntando a `/admin/fraccionamientos/<id>`.
  - Pestañas del detalle: `TABS_FRACCIONAMIENTO = ['domicilios', 'usuarios', 'accesos'] as const`, con `domicilios` por defecto y etiquetas "Domicilios", "Usuarios" y "Accesos". Las pestañas `domicilios` y `accesos` muestran un `EmptyState` "Disponible pronto." hasta las tareas 5 y 6. `usuarios` mantiene lo que ya existe.
  - Breadcrumbs del detalle: Fraccionamientos (`/admin/fraccionamientos`) › nombre.

- [ ] **Step 1: Pruebas:**
  - `navItemsPara('plataforma', null)` devuelve Inicio y Fraccionamientos.
  - Con `pathname = '/admin/fraccionamientos/5'`, el ítem activo (`aria-current="page"`) es Fraccionamientos y no Inicio.
  - `SidebarContent` en la variante plataforma muestra "Consola de plataforma" y "Super admin".
  - `admin/fraccionamientos/page`: un tesorero → `notFound()`; muestra la tabla.
  - El detalle no tiene pestañas de catálogos; `?tab=cuotas` cae en `domicilios`.
  - Las pruebas de la consola de catálogos se eliminan junto con su código.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 3: Inicio con métricas

**Files:**
- Create: `src/features/fraccionamientos/metricas.ts` (+ test), `src/features/fraccionamientos/components/metricas-plataforma.tsx` (+ test)
- Modify: `src/app/admin/page.tsx` (+ test)

**Interfaces:**
- Consumes: el layout y la página de Inicio (tarea 2); la lectura del super admin sobre domicilios, residentes, teléfonos y tarjetas (tarea 1).
- Produces:
  - `export type MetricasFraccionamiento = { id: number; nombre: string; activo: boolean; domicilios: number; residentes: number; usuariosActivos: number; tarjetas: number; telefonos: number }`
  - `export async function listMetricasFraccionamientos(supabase): Promise<MetricasFraccionamiento[]>`. Es una sola consulta a `fraccionamientos` con conteos embebidos: `domicilios(count)`, `residentes(count)`, `tarjetas_acceso(count)`, `telefonos_acceso(count)` y `perfiles(count)` filtrado a `activo = true` con un alias. Ordena por nombre.
  - `export function totalesPlataforma(rows: MetricasFraccionamiento[]): { fraccionamientos: number; activos: number; domicilios: number; residentes: number; usuariosActivos: number; tarjetas: number; telefonos: number }`
  - `MetricasPlataforma({ rows })`:
    - Seis `MetricCard`: "Fraccionamientos" con valor `<activos> de <total>`, "Domicilios", "Residentes", "Usuarios activos", "Tarjetas de acceso" y "Teléfonos de acceso".
    - Una `SectionCard` "Por fraccionamiento" con `DataTable`: Nombre (enlace), Estado (`StatusBadge` Activo/Inactivo), Domicilios, Residentes, Usuarios activos, Tarjetas y Teléfonos.
    - Sin filas: `EmptyState` "Aún no hay fraccionamientos." con la acción "+ Nuevo fraccionamiento" (`FraccionamientoDialog`).

- [ ] **Step 1: Pruebas:**
  - `listMetricasFraccionamientos` mapea `[{ count: n }]` a números y aplica el filtro de perfiles activos.
  - `totalesPlataforma` suma correctamente y cuenta los activos.
  - El componente muestra los seis valores y una fila por fraccionamiento; sin filas, el estado vacío.
  - Página: un tesorero → `notFound()`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Si PostgREST no permite filtrar un conteo embebido, usar una segunda consulta agrupada sobre `perfiles` (`fraccionamiento_id`, conteo, `activo = true`). Nunca una consulta por fraccionamiento.
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 4: Acciones de consola para domicilios, residentes y accesos

**Files:**
- Modify: `src/features/domicilios/actions.ts`, `src/features/residentes/actions.ts`, `src/features/accesos/actions.ts` (+ sus tests)
- Create: `src/features/fraccionamientos/operacion-actions.ts` (`'use server'`, + test)
- Modify: los componentes que importan acciones directamente, para recibirlas por props con las actuales como valor por defecto:
  - `src/features/domicilios/components/{add-domicilio-dialog,edit-domicilio-dialog}.tsx`
  - `src/features/residentes/components/{residente-dialog,residente-actions,residentes-section}.tsx`
  - `src/features/accesos/components/{accesos-section,acceso-item,numero-dialog}.tsx`

**Interfaces:**
- Consumes: `runSuperAdminAction` (`src/lib/auth/run-action.ts`); permisos de la tarea 1.
- Produces:
  - Cada archivo de acciones mueve su lógica a funciones internas que reciben `fraccionamientoId: number | null`.
    - Con `null`: idéntico a hoy.
    - Con un id: filtra por `fraccionamiento_id` en lecturas, validaciones (dirección duplicada, límites de teléfonos y tarjetas) y updates/deletes, y lo incluye en inserts.
  - En `operacion-actions.ts`, todas con `runSuperAdminAction`, devuelven `ActionResult` y revalidan `/admin/fraccionamientos/<fid>`, más el detalle del domicilio cuando aplica:
    - `crearDomicilioEnFraccionamiento(fid: number, input: DomicilioInput): Promise<ActionResult<{ id: number }>>`: inserta en `domicilios` y `domicilio_concepto` con `fraccionamiento_id: fid` y `created_by` = id del super admin.
    - `actualizarDomicilioEnFraccionamiento(fid: number, id: number, input: DomicilioDatosInput)`: solo `direccion`, `fecha_alta` y `observaciones`; nunca toca `domicilio_concepto`. `DomicilioDatosInput` es el esquema de domicilio sin `conceptoId`; se exporta desde `src/features/domicilios/schemas.ts`.
    - `crearResidenteEnFraccionamiento(fid, domicilioId, input)`, `actualizarResidenteEnFraccionamiento(fid, id, domicilioId, input)` y `eliminarResidenteEnFraccionamiento(fid, id, domicilioId)`.
    - `crearTelefonoEnFraccionamiento(fid, domicilioId, valor)`, `actualizarTelefonoEnFraccionamiento(fid, id, domicilioId, valor)` y `eliminarTelefonoEnFraccionamiento(fid, id, domicilioId)`, más las tres equivalentes para tarjetas.
  - Props de los componentes:
    - `AccionesAccesos = { crearTelefono, actualizarTelefono, eliminarTelefono, crearTarjeta, actualizarTarjeta, eliminarTarjeta }` y `AccionesResidentes = { crear, actualizar, eliminar }`, con las firmas de las acciones actuales (sin `fid`; en la consola se ligan con `.bind(null, fid)`).
    - `AccesosSection` y `ResidentesSection` aceptan `acciones?`.
    - `AddDomicilioDialog` acepta `crear?`.
    - `EditDomicilioDialog` acepta `actualizar?` y `editarTipoCuota?: boolean` (por defecto `true`; con `false` oculta el campo de tipo de cuota y llama a `actualizar` sin `conceptoId`).

- [ ] **Step 1: Pruebas:**
  - Cada acción de consola con un administrador → `MSG_NO_PERMISO` sin llamar a Supabase (Review Focus 1).
  - `crearDomicilioEnFraccionamiento(7, …)` inserta `domicilios` y `domicilio_concepto` con `fraccionamiento_id: 7`; con una dirección repetida dentro del 7 → el mensaje de duplicado actual.
  - `actualizarDomicilioEnFraccionamiento` no llama a `from('domicilio_concepto')`.
  - Teléfonos: con 2 ya registrados en ese domicilio y fraccionamiento, `crearTelefonoEnFraccionamiento` → el mensaje de límite actual (Review Focus 5).
  - Las pruebas existentes de las acciones del administrador siguen pasando sin cambios de intención.
  - Componentes: con `acciones` personalizadas, el diálogo de teléfono y el botón de eliminar residente llaman a las funciones recibidas; con `editarTipoCuota={false}` no aparece el campo de tipo de cuota.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 5: Pestaña Domicilios y detalle de domicilio en la consola

**Files:**
- Modify: `src/app/admin/fraccionamientos/[id]/page.tsx` (+ test)
- Create: `src/app/admin/fraccionamientos/[id]/domicilios/[domicilioId]/page.tsx` (+ test)
- Modify: `src/features/domicilios/components/{domicilios-view,domicilios-table}.tsx` (+ tests): prop `mostrarEstatus?: boolean` (por defecto `true`) y `hrefDetalle?: (id: number) => string` (por defecto `/domicilios/<id>`).
- Modify: `src/features/domicilios/queries.ts` (y las de residentes y accesos si hace falta): parámetro opcional `fraccionamientoId` para filtrar.

**Interfaces:**
- Consumes: tareas 2 y 4.
- Produces:
  - **Pestaña `domicilios`:**
    - `DomiciliosView` con `mostrarEstatus={false}` y `hrefDetalle={(d) => '/admin/fraccionamientos/<fid>/domicilios/<d>'}`, con los domicilios del fraccionamiento. La consulta no selecciona `estatus`.
    - Acción de cabecera "+ Nuevo domicilio" con `AddDomicilioDialog` (`crear = crearDomicilioEnFraccionamiento.bind(null, fid)` y `conceptos` = tipos de cuota recurrentes de ese fraccionamiento).
    - Si no hay tipos de cuota: botón deshabilitado y el texto exacto "El administrador del fraccionamiento debe capturar los tipos de cuota primero." (Review Focus 4).
  - **Detalle del domicilio:**
    - Llama a `requireSuperAdminPage()` y valida ambos ids. Si el domicilio no existe **o** su `fraccionamiento_id` no coincide con el de la URL → `notFound()` (Review Focus 3).
    - Botón "Volver" a la pestaña de domicilios y breadcrumbs: Fraccionamientos › nombre › dirección.
    - `DomicilioInfoCard` con `EditDomicilioDialog` (`editarTipoCuota={false}`, `actualizar` ligado).
    - `AccesosSection` y `ResidentesSection` con `acciones` ligadas a `fid`.
    - **Sin** `CuotasSection` ni `PagosExtraSection`.

- [ ] **Step 1: Pruebas:**
  - Pestaña domicilios:
    - la tabla no tiene la columna "Estatus" ni los textos "Al corriente" o "Moroso";
    - los enlaces apuntan a la ruta de consola;
    - sin tipos de cuota, el botón está deshabilitado y aparece el aviso exacto.
  - Detalle:
    - un domicilio de B con la URL de A → `notFound()`;
    - un tesorero → `notFound()`;
    - no se renderizan "Cuotas" ni "Pagos extra";
    - aparecen "Accesos" y "Residentes".
  - `DomiciliosTable` sin props sigue mostrando el estatus (comportamiento del administrador).
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** los cuatro comandos → verde.
- [ ] **Step 5: Listo para commit.**

---

### Task 6: Pestaña Accesos con el reporte del super admin

**Files:**
- Create: `src/features/fraccionamientos/accesos-admin.ts` (+ test)
- Modify: `src/app/admin/fraccionamientos/[id]/page.tsx` (+ test)
- Reutilizar: `src/features/reportes/components/{periodo-reporte-filtros,accesos-telefono-tabla,accesos-tarjeta-tabla}.tsx`, con props para la ruta base de los filtros si hace falta.

**Interfaces:**
- Consumes: `reporte_accesos_admin` (tarea 1), con sus tipos regenerados.
- Produces:
  - `export async function listAccesosAdmin(supabase, fid: number, anio: number, mes: number, tipo: 'telefono' | 'tarjeta')`. Llama al RPC y adapta las filas al formato que esperan `AccesosTelefonoTabla` (`telefono_1`, `telefono_2`) o `AccesosTarjetaTabla` (`tarjeta_1..3`).
  - Pestaña `accesos`:
    - Filtros de año y mes en la URL (`?tab=accesos&anio=&mes=`), por defecto el periodo actual (`currentPeriod()` de `src/lib/dates.ts`).
    - Dos `SectionCard`, "Acceso vehicular" (teléfonos) y "Acceso peatonal" (tarjetas), con las tablas existentes.
    - Sin filas: el estado vacío de esas tablas.

- [ ] **Step 1: Pruebas:**
  - `listAccesosAdmin` llama a `rpc('reporte_accesos_admin', { p_fraccionamiento_id: 5, p_anio: 2026, p_mes: 1, p_tipo: 'tarjeta' })` y mapea `valor_1..3` a `tarjeta_1..3`.
  - Un error del RPC lanza `Error`.
  - La página con `?tab=accesos` usa el periodo actual por defecto y muestra ambas secciones.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificación final:**
  - los cuatro comandos de npm → verde;
  - `supabase test db </dev/null` → PASS;
  - `grep -rn "CuotasSection\|PagosExtraSection\|estatus" src/app/admin` → vacío.
- [ ] **Step 5: Listo para commit.**

## Resultado y pendientes (2026-11-11)

Las 6 tareas están completas y revisadas, y la revisión final se aplicó. Resultados: vitest 577, pgTAP 721, y tsc, lint y build limpios.

**Decisiones tomadas durante la ejecución:**
- El super admin que actualiza `domicilio_concepto` afecta 0 filas; la política no lanza error.
- La tabla de domicilios de la consola agrega la columna "Tipo de cuota". La columna "Accesos" se pospuso porque el detalle ya los muestra.
- `reporte_accesos_admin` también concede `execute` a `service_role`. Es inofensivo, porque la función responde 42501, y se desvía de §1.
- La consola limita el año a 2100 o menos y, si se pasa, vuelve al periodo actual.
- Se agregaron 6 pruebas pgTAP a `reporte_accesos_admin`: pagadas, pendientes y vencidas, `acceso_tarjeta` y `acceso_telefono`, y `search_path`.
- En la consola, la ruta de inicio de los breadcrumbs es `/admin` y el estado vacío usa un texto neutral.

**Pendientes:**
- **Brecha:** la consola permite crear un domicilio con tipo "Sin asignar", y la base deja que el super admin le asigne un tipo después, con un INSERT en `domicilio_concepto`.
  - Para cerrarla hay que exigir el tipo en la consola, validándolo en el formulario y en `crearDomicilioEnFraccionamiento`.
  - El intento de ocultar "Sin asignar" se revirtió porque dejaba el select en blanco sin validación. La prop `permitirSinAsignar` ya existe.
- **Opcionales:**
  - crear el domicilio de forma atómica con un RPC;
  - ligar el aviso con `aria-describedby`;
  - probar los estados vacíos de la pestaña Accesos.
