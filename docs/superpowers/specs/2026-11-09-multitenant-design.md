# Proyecto multi-tenant basado en Lago Amadeo: diseño

Fecha: 2026-11-09 · Estado: aprobado para implementación (revisado contra el esquema real el 2026-11-09)

## Objetivo

Crear un producto nuevo, en un repositorio y un proyecto de Supabase propios, para administrar **varios fraccionamientos** con la misma funcionalidad que hoy tiene Lago Amadeo. Un **super admin** crea y configura los fraccionamientos. Cada fraccionamiento tiene sus propios datos, usuarios y catálogos, y ningún usuario puede ver ni modificar datos de otro fraccionamiento.

Éxito:

- El super admin da de alta un fraccionamiento con su nombre y su primer Administrador.
- Ese Administrador opera la app completa (domicilios, residentes, cuotas, pagos, movimientos, reportes, usuarios y configuración) sin ver nada de otros fraccionamientos.
- El aislamiento lo garantiza la base de datos (RLS) y lo demuestran pruebas automáticas.

El repositorio y el proyecto actuales de Lago Amadeo **no se modifican**.

## Decisiones acordadas

| Tema | Decisión |
|---|---|
| Jerarquía | Super admin → fraccionamientos. No hay nivel de administradora. |
| Tenant | El fraccionamiento. |
| Membresía | Cada usuario pertenece a **un solo** fraccionamiento. Al iniciar sesión entra directo, sin selector y sin el fraccionamiento en la URL. |
| Roles | `super_admin` en toda la plataforma. Por fraccionamiento: `administrador`, `tesorero`, `comite` y `vigilancia`. Todos son personal del fraccionamiento; los residentes no tienen usuario. |
| Aislamiento | Una sola base con `fraccionamiento_id` en las tablas de negocio y políticas RLS por fraccionamiento y rol. |
| Identidad del fraccionamiento | Solo el **nombre**. Sin logo ni color propios: toda la app usa la paleta actual y el logo genérico del producto. |
| Datos iniciales | El proyecto arranca vacío, salvo los catálogos globales y el usuario super admin. No se migran datos de Lago Amadeo. |
| Repositorio | Copia limpia del código actual, sin historial de git. |

**Repositorio:** `~/dev/app-fraccionamientos`, con remoto `github.com/Miguel-Maldonado-dev/app-fraccionamientos`; creado por el usuario el 2026-11-09. **Pendiente:** la región del proyecto nuevo de Supabase. No se necesita hasta enlazar la nube.

## 1. Repositorio y base de datos

### Repositorio

- **Carpeta:** `~/dev/app-fraccionamientos`, hermana de `lago_amadeo`. Lleva una copia de `lago_amadeo_nextjs`, excluyendo `.git`, `.env.local`, `.next`, `node_modules`, `.superpowers` y `.claude/settings.local.json`.
- **Contenido:** se copian `docs/superpowers/specs/` y `docs/superpowers/plans/` de este proyecto como historial de diseño, más esta especificación.
- **Commits:** el usuario hace todos los commits y crea el remoto (`gh repo create`). La implementación no hace commits ni push.
- **Configuración del proyecto nuevo:**
  - `.env.example` con las mismas dos variables públicas, más `SUPABASE_SERVICE_ROLE_KEY`, que solo se usa en el servidor para dar de alta usuarios.
  - Un `.mcp.json` propio apuntando al `project_ref` nuevo.
- **Fuente:** se incluye en el repositorio (`next/font/local`), igual que hoy.

### Base de datos

1. **Referencia del esquema (hecho).** Extraída con el MCP de Supabase en modo solo lectura y guardada en `supabase/reference/lago-amadeo-schema.sql`, como referencia, no como migración.
2. **Migraciones.** Esquema multi-tenant nuevo en `supabase/migrations/`, escrito y versionado en el repositorio, en este orden:
   1. Catálogos globales.
   2. Fraccionamientos y perfiles.
   3. Tablas de negocio.
   4. Vistas.
   5. Funciones.
   6. Políticas RLS y permisos.
   7. Datos iniciales (`supabase/seed.sql`).
3. **Desarrollo local.** Con `supabase start`, en los puertos 553xx (API 55321, base 55322, Studio 55323), para convivir con otro stack local. Las pruebas de RLS corren con `supabase test db`.
4. **Nube.** El usuario crea el proyecto en el panel y lo enlaza con `supabase link`. `supabase db push` solo se ejecuta cuando el usuario lo indique.
5. **Tipos.** `src/lib/supabase/database.types.ts` se regenera desde la base local (`supabase gen types typescript --local`).

## 2. Modelo de datos y seguridad

### Tablas nuevas

- **`fraccionamientos`:**
  - `id bigint identity`, `nombre text not null`, `slug text not null unique`, `instalacion_id uuid unique` (opcional; id de la instalación de Access Core, ver "Integración futura"), `activo boolean not null default true`, `created_at timestamptz`.
- **`perfiles`:**
  - `id uuid` PK que referencia `auth.users` con `ON DELETE CASCADE`, más `fraccionamiento_id bigint` que referencia `fraccionamientos`, `rol rol_usuario not null`, `nombre text not null`, `email text not null` (copia del email de Auth, la usan `users_info` y `reporte_pagos_detalle`), `activo boolean not null default true` y `created_at`.
  - `rol_usuario` es un enum con `super_admin`, `administrador`, `tesorero`, `comite` y `vigilancia`.
  - Un CHECK obliga a que `fraccionamiento_id` esté vacío si y solo si `rol = 'super_admin'`.
  - Reemplaza a `users` y `user_roles` del esquema actual.

### Alcance por tabla

- **Globales, de solo lectura para cualquier usuario con sesión:** `meses`, `anios`, `estatus`, `metodos_pago`, `tipos_movimientos` y `tipo_pago`.
- **Por fraccionamiento** (`fraccionamiento_id bigint not null references fraccionamientos`, con índice):
  - Negocio: `domicilios`, `domicilio_concepto`, `residentes`, `telefonos_acceso`, `tarjetas_acceso`, `cuotas`, `descuento_cuota`, `recargo_cuota`, `pagos` y `movimientos_financieros`.
  - Catálogos: `conceptos_pago`, `concepto_pago_acceso`, `conceptos_descuento` y `conceptos_recargo`.
- **Restricciones únicas por fraccionamiento:**
  - Dirección en `domicilios`.
  - Nombre en minúsculas en cada catálogo; en `conceptos_pago` el nombre es único por fraccionamiento y `tipo_pago_id`.
  - `concepto_pago_acceso.concepto_pago_id`.
  - Una cuota por domicilio, concepto, año y mes.
- **Coherencia entre tablas:** las llaves foráneas entre tablas de negocio se hacen compuestas con `(id, fraccionamiento_id)`, para que una fila no pueda apuntar a otra de otro fraccionamiento. Por ejemplo, una cuota de A no puede usar un domicilio de B.

### Funciones de apoyo

Las tres son `security definer`, `stable` y con `search_path` fijo, y viven en el esquema `private`, que no se expone por la API:

- `private.fraccionamiento_actual() returns bigint`
- `private.rol_actual() returns rol_usuario`
- `private.es_super_admin() returns boolean`

Leen `perfiles` con `auth.uid()` y solo consideran perfiles con `activo` en verdadero cuyo fraccionamiento también esté activo. En las políticas se usan siempre envueltas en `(select …)`.

### Políticas RLS

RLS se habilita en todas las tablas, sin políticas `USING true`.

| Operación | Quién |
|---|---|
| Leer datos del fraccionamiento | Cualquier rol del fraccionamiento, más el super admin |
| Escribir domicilios, residentes y accesos | administrador |
| Escribir cuotas, pagos y movimientos | administrador y tesorero |
| Escribir catálogos del fraccionamiento | administrador |
| Leer perfiles del fraccionamiento | Cualquier rol del fraccionamiento (los reportes muestran quién registró cada pago). |
| Escribir perfiles del fraccionamiento | administrador, y solo con roles distintos de `super_admin`. Cada usuario puede leer su propio perfil aunque esté inactivo. |
| `fraccionamientos` | Lectura del propio fraccionamiento para sus miembros. Lectura y escritura completas para el super admin. |
| Comité y vigilancia | Solo lectura. Vigilancia, además, solo lee domicilios, residentes y accesos. |

- **Columna `fraccionamiento_id` en inserciones:** su `DEFAULT` es `private.fraccionamiento_actual()`, y el `WITH CHECK` exige que el valor sea igual al fraccionamiento del usuario, salvo para el super admin.
- **Vistas:** todas se crean con `security_invoker = true`.
- **Funciones de negocio:** `generar_cuotas(p_anio, p_mes)` genera solo para el fraccionamiento del usuario y exige rol `administrador` o `tesorero`.
- **Funciones de negocio, además:**
  - `marcar_cuotas_vencidas()` la ejecuta `pg_cron` a diario (`0 6 * * *`) como `postgres`, sin usuario; procesa todos los fraccionamientos y no se expone a `authenticated`.
  - El trigger `fn_pago_to_movimiento` copia `fraccionamiento_id` del pago al movimiento.
  - `fn_actualizar_cuotas_concepto` y `fn_residente_principal` se conservan; ya filtran por domicilio.
- **Permisos (GRANT):** la versión local del CLI ya no da permisos por defecto en `public`. Cada migración otorga explícitamente lo necesario a `authenticated` (y `service_role`); `anon` no recibe permisos sobre tablas, vistas ni funciones.
- **Vistas que se migran:** solo las 11 que usa la app: `users_info`, `domicilios_info`, `cuotas_info`, `pagos_info`, `residentes_info`, `domicilio_concepto_info`, `movimientos_info`, `reporte_pagos_detalle`, `resumen_financiero_completo`, `accesos_telefono_info` y `accesos_tarjeta_info`.
- **Recibos:** cada pago guarda un JSON pequeño en `pagos.recibo` y el PDF se genera al abrirlo (ver `2026-11-10-recibos-design.md`). No hay Storage.

### Alta de usuarios

Es una Server Action que usa la service role key y solo corre en el servidor:

- La puede ejecutar el super admin, para cualquier rol de un fraccionamiento, o el Administrador, solo para su fraccionamiento y sin poder crear `super_admin`.
- Crea el usuario en Auth y su `perfil` en una sola operación lógica. Si falla el perfil, borra el usuario de Auth.
- Reemplaza al edge function `create-user`, que hoy no verifica quién lo llama.

### Pruebas de aislamiento (pgTAP)

Las datos de prueba son dos fraccionamientos, A y B, con un usuario de cada rol en cada uno y un super admin. Se prueba que:

- Ningún rol de A lee filas de B en ninguna tabla ni vista por fraccionamiento.
- Ningún rol de A inserta con el `fraccionamiento_id` de B ni actualiza o borra filas de B.
- Cada rol tiene exactamente los permisos de escritura de la tabla de arriba.
- Un usuario inactivo, o de un fraccionamiento inactivo, no lee nada.
- El Administrador no puede crear ni promover a `super_admin`.
- El super admin lee y escribe en ambos fraccionamientos.

## 3. Aplicación

### Contexto del tenant

- **`getTenantContext()`:** un nuevo helper de servidor envuelto en `React.cache`. Devuelve `{ user, perfil, fraccionamiento | null }` y reemplaza a `getCurrentUser` como fuente del rol.
- **Proxy de autenticación:** igual que hoy, más estas redirecciones:
  - Super admin → `/admin`.
  - Roles de fraccionamiento → la app.
  - Perfil inactivo o fraccionamiento inactivo → `/sin-acceso`, con el mensaje "Tu acceso está desactivado. Contacta al administrador."
  - Un rol de fraccionamiento que entra a `/admin` → 404.
- **Constantes:** `ROLES`, `ROLES_GESTION` y los ítems del menú pasan a usar los valores del enum. `visibleNavItems` sigue filtrando por rol.

### Consola del super admin (`/admin`)

- **Lista de fraccionamientos:** nombre, slug, estado, número de usuarios y número de domicilios.
- **Crear y editar fraccionamiento:**
  - Nombre*.
  - Slug*: se genera desde el nombre y se puede editar; minúsculas y guiones.
  - Activo.
- **Usuarios de un fraccionamiento:** el super admin crea y desactiva usuarios con cualquier rol del fraccionamiento, empezando por su primer Administrador.
- **Catálogos de un fraccionamiento:** el super admin captura los catálogos iniciales del fraccionamiento (tipos de cuota, conceptos extra, descuentos y recargos) reutilizando las pestañas y diálogos de Configuración. El fraccionamiento nace con los catálogos vacíos; no hay valores precargados. Después, el Administrador los edita desde Configuración.
- **Diseño:** usa los componentes y estilos actuales de la app, con su propio menú: Fraccionamientos.

### Pantallas existentes

- **Lecturas:** no agregan filtros por fraccionamiento, porque RLS los aplica.
- **Inserciones:** no envían `fraccionamiento_id`.
- **Errores:** las acciones siguen validando el rol en el servidor con `runAction`, ahora con los roles del enum. Esto sirve como defensa en profundidad y para dar mensajes claros.
- **Usuarios:** el Administrador ve y crea solo usuarios de su fraccionamiento, con los roles administrador, tesorero, comité y vigilancia.
- **Configuración** (catálogos): queda por fraccionamiento. Los nombres repetidos ahora también los rechaza la restricción única de la base.
- **Exportaciones ZKTeco y Eldesgate:** desactivadas (decisión del 2026-11-10). Eran parte de la aplicación anterior; la gestión de accesos se hará más adelante con la API de Access Core (ver "Integración futura"). Se eliminan las rutas `/api/exports/*` y sus botones; los reportes de accesos se quedan como tablas de consulta.

### Nombre del fraccionamiento

- **Carga:** el layout de `(app)` toma el nombre de `getTenantContext()`.
- **Dónde se aplica:**
  - Nombre en el menú lateral y la barra superior, junto al logo genérico del producto.
  - `<title>` con el formato `<nombre del fraccionamiento> · <producto>`.
  - Recibos y PDF de movimientos con el nombre del fraccionamiento.
- **Colores:** sin cambios; toda la app usa la paleta actual.
- **Textos fijos:** los textos "Lago Amadeo" del código se reemplazan por el nombre del fraccionamiento. Las descripciones de página pasan a ser genéricas, por ejemplo "Gestiona los domicilios del fraccionamiento."

### Pruebas de la app

- Las pruebas actuales se adaptan a los roles nuevos y al nombre dinámico.
- Pruebas nuevas:
  - `getTenantContext()` y las redirecciones por rol y estado.
  - La consola del super admin: validación de nombre y slug.
  - La alta de usuarios, incluyendo la compensación en Auth y el rechazo de `super_admin` por parte de un Administrador.
  - El nombre del fraccionamiento en el layout y en los PDF.

## Fases de implementación

El plan dividirá el trabajo en fases. Cada fase deja software funcionando y probado:

0. **Arranque (hecho):** carpeta nueva, copia limpia, `supabase init`, referencia del esquema y app corriendo contra la base local con el esquema de referencia.
1. **Esquema multi-tenant:** migraciones, RLS, permisos, funciones, cron, seed y pgTAP en verde.
2. **App con tenant:** `getTenantContext`, proxy, roles nuevos, alta de usuarios, nombre del fraccionamiento en la interfaz y pantallas actuales funcionando sobre el esquema nuevo.
3. **Consola del super admin.**
4. **Recibos y nube:** recibos PDF sin edge functions, build y guía para enlazar el proyecto en la nube. (Las exportaciones quedaron desactivadas en la fase 3.)

## Integración futura: control de acceso (Access Core)

Resuelta en un proyecto aparte: ver [`2026-11-11-medios-acceso-access-core-design.md`](2026-11-11-medios-acceso-access-core-design.md) (medios de acceso, cola de sincronización y pantalla `/accesos`) y la nota de mapeo en `docs/integraciones/access-core-mapeo.md`. La documentación OpenAPI sigue en `docs/integraciones/access-core-openapi.json`.

## Fuera de alcance

- Portal de residentes, pagos en línea y registro por autoservicio.
- "Entrar como" un fraccionamiento desde la consola.
- Migrar datos de Lago Amadeo.
- Un agente de impresión configurable por fraccionamiento.
- Varios fraccionamientos por usuario.
- Cualquier cambio en el repositorio o en el proyecto de Supabase de Lago Amadeo.

## Riesgos

- **Una política RLS mal escrita filtra datos entre tenants.** Se mitiga con las pruebas pgTAP de la sección 2, obligatorias antes de cada `db push`.
- **La service role key permite saltarse RLS.** Se usa solo en el servidor y solo dentro de la acción de alta de usuarios, nunca con el prefijo `NEXT_PUBLIC_`.
- **El dump del esquema actual puede incluir objetos que la app no usa,** como los edge functions antiguos o las vistas sin uso. Las migraciones nuevas incluyen solo lo que la app usa, y la referencia queda solo como consulta.
