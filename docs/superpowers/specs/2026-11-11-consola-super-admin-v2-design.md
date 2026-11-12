# Consola del super admin v2: diseño

Fecha: 2026-11-11 · Estado: aprobado (2026-11-11). Modifica la consola de la fase 3 (`2026-11-10-multitenant-fase3-consola.md`).

## Objetivo

El super admin de WEADMI administra la plataforma y **la parte de accesos** de cada fraccionamiento:

- edita los datos generales de los fraccionamientos y crea o activa sus usuarios;
- da de alta domicilios;
- gestiona residentes, teléfonos y tarjetas de acceso;
- consulta los reportes de acceso.

**No toca nada financiero ni de cuotas:**

- no ve cuotas, pagos ni movimientos;
- no administra catálogos;
- no cambia el tipo de cuota de un domicilio ya creado.

La consola usa la misma experiencia visual que los fraccionamientos, con menú lateral, y tiene un inicio con métricas.

**Éxito:**

- Menú lateral igual al de los fraccionamientos, con Inicio y Fraccionamientos.
- Inicio con conteos de la plataforma y por fraccionamiento.
- En el detalle de un fraccionamiento:
  - datos generales;
  - usuarios;
  - domicilios: crear (eligiendo su tipo de cuota solo al crearlo), editar dirección, fecha de alta y observaciones, y entrar a cada uno para gestionar residentes, teléfonos y tarjetas;
  - reportes de acceso vehicular y peatonal.
- La base le impide al super admin leer o escribir datos financieros, escribir catálogos y cambiar el tipo de cuota de un domicilio.

## No objetivos y anti-objetivos

- **Fuera de alcance:**
  - "Entrar como" un fraccionamiento.
  - Catálogos desde la consola: los captura el administrador de cada fraccionamiento.
  - Eliminar domicilios.
  - Editar nombre o rol de usuarios.
  - Generar cuotas.
  - Métricas financieras.
- **Anti-objetivos:**
  - Que la consola muestre un monto o un estado de pago ("Al corriente", "Moroso", "Pagado").
  - Que el super admin pueda registrar pagos, modificar cuotas o catálogos, o cambiar el tipo de cuota, aunque use la API directamente.
  - Duplicar componentes que ya existen.

## Decisiones del usuario (2026-11-11)

- **Enfoque A:** pantallas propias en `/admin` que reutilizan componentes.
- **Alcance opción 1:**
  - El super admin crea domicilios eligiendo el tipo de cuota solo al crearlos; no lo puede cambiar después.
  - No administra catálogos; los tipos de cuota los captura el administrador. Esto revierte lo acordado en la fase 3.
  - Gestiona residentes, accesos y usuarios.
- **Reportes de acceso:** sí los ve, aunque indirectamente revelen qué domicilios pagaron el mes.
- **Restricciones en la base, no solo en la interfaz.**
- **Métricas solo de conteo.**

## Enfoques considerados

- **A. Pantallas propias en `/admin` (elegido).**
- **B.** "Entrar" a un fraccionamiento: descartado porque mezcla tipos de usuario en las mismas rutas.
- **C.** Pantallas duplicadas: descartado porque duplica código.

Dentro de A, el usuario eligió este alcance sobre uno simplificado (solo datos generales y usuarios).

## Diseño

### 1. Base de datos (migración nueva)

Permisos del super admin sobre las tablas de negocio. Se ajusta la rama `(select private.es_super_admin())` de cada política:

| Tablas | Leer | Insertar | Actualizar | Borrar |
|---|---|---|---|---|
| `domicilios` | sí | sí | sí | no |
| `domicilio_concepto` | sí | sí | **no** | no |
| `residentes`, `telefonos_acceso`, `tarjetas_acceso` | sí | sí | sí | sí |
| `conceptos_pago`, `concepto_pago_acceso` | sí | no | no | no |
| `conceptos_descuento`, `conceptos_recargo`, `cuotas`, `descuento_cuota`, `recargo_cuota`, `pagos`, `movimientos_financieros` | no | no | no | no |

- La lectura de `conceptos_pago` y `concepto_pago_acceso` hace falta para elegir el tipo de cuota al crear un domicilio y para saber si el domicilio usa teléfonos y tarjetas.
- Como no puede actualizar `domicilio_concepto`, el trigger que reajusta cuotas nunca se dispara desde la consola.
- `fraccionamientos` y `perfiles` no cambian.
- **`domicilios_info.estatus`** valdría siempre "Al corriente" para el super admin. La consola **nunca selecciona esa columna** (decisión de diseño). La vista no cambia.
- **Reporte de accesos para el super admin.** Función `public.reporte_accesos_admin(p_fraccionamiento_id bigint, p_anio int, p_mes int, p_tipo text)`:
  - `p_tipo` es `'telefono'` o `'tarjeta'`.
  - Es `security definer`, `stable` y con `search_path = ''`.
  - Lo primero que hace es `if not (select private.es_super_admin()) then raise exception 'No autorizado' using errcode = '42501'`.
  - Devuelve las mismas filas que ve el fraccionamiento en Reportes (`accesos_telefono_info` o `accesos_tarjeta_info`): solo los domicilios con la cuota del periodo pagada. Filtra por fraccionamiento, año y mes, y devuelve `cuota_id`, `domicilio_id`, `direccion`, `anio`, `mes` y `telefono_1..2` o `tarjeta_1..3`, sin montos.
  - `revoke execute … from public, anon` y `grant execute … to authenticated`.
  - Es la única función `security definer` en `public`; la justifica que el super admin no tiene acceso a `cuotas`.
- **pgTAP:**
  - La matriz de `040` cambia las filas del super admin según la tabla.
  - Las pruebas de la fase 3 sobre "super crea catálogos iniciales" pasan a esperar 42501.
  - Pruebas nuevas: el super admin no actualiza `domicilio_concepto` (0 filas o 42501, según la política); `reporte_accesos_admin` devuelve filas de A para el super admin, lanza 42501 para un administrador y no mezcla A con B.

### 2. Navegación y layout de `/admin`

- `/admin` usa el mismo esqueleto que `(app)`: `Sidebar`, `AppBar`, menú móvil y `BrandLogo`.
  - Subtítulo bajo el logo: "Consola de plataforma".
  - Usuario: nombre del perfil y el rol "Super admin".
- Menú propio del super admin:
  - Inicio (`/admin`);
  - Fraccionamientos (`/admin/fraccionamientos`).
- Cada página sigue con `requireSuperAdminPage()` y cada acción con `runSuperAdminAction`.

### 3. Inicio (`/admin`)

- `PageHeader` con el título "Inicio" y la descripción "Resumen de la plataforma."
- **Tarjetas de métricas:**
  - Fraccionamientos (activos de total);
  - Domicilios;
  - Residentes;
  - Usuarios activos (sin contar al super admin);
  - Tarjetas de acceso;
  - Teléfonos de acceso.
- **Tabla "Por fraccionamiento":** nombre (enlace al detalle), estado, domicilios, residentes, usuarios activos, tarjetas y teléfonos. Ordenada por nombre. Si no hay fraccionamientos, estado vacío con "+ Nuevo fraccionamiento".
- **Consultas:** con `count` o una sola consulta agrupada, nunca una consulta por fraccionamiento.

### 4. Fraccionamientos

- **`/admin/fraccionamientos`:** la lista actual de la fase 3 se mueve aquí desde `/admin`.
- **`/admin/fraccionamientos/[id]`:**
  - `PageHeader` con el nombre y el botón para editar los datos generales.
  - Pestañas en la URL: `domicilios` (por defecto), `usuarios` y `accesos`. Las de catálogos de la fase 3 desaparecen.
  - **Domicilios:**
    - Tabla con dirección, residente principal, tipo de cuota y accesos, **sin la columna de estatus**. Incluye búsqueda.
    - "+ Nuevo domicilio" reutiliza el formulario actual con el tipo de cuota de ese fraccionamiento (lista de `conceptos_pago` recurrentes). Si el fraccionamiento no tiene tipos de cuota, el botón queda deshabilitado con el aviso "El administrador del fraccionamiento debe capturar los tipos de cuota primero."
    - Cada fila enlaza al detalle.
  - **Usuarios:** lo que ya existe (crear, activar y desactivar).
  - **Accesos:** acceso vehicular (teléfonos) y peatonal (tarjetas) para un año y mes (por defecto el actual), con las mismas tablas de Reportes, alimentadas por `reporte_accesos_admin`.
- **`/admin/fraccionamientos/[id]/domicilios/[domicilioId]`:**
  - Tarjeta del domicilio. Su edición solo cubre dirección, fecha de alta y observaciones; el tipo de cuota se muestra pero no se edita.
  - `AccesosSection` (teléfonos y tarjetas con los límites actuales).
  - `ResidentesSection`.
  - **No** se montan `CuotasSection` ni `PagosExtraSection`.
  - Botón "Volver" y breadcrumbs: Fraccionamientos › nombre › dirección.
  - Si el domicilio no pertenece a ese fraccionamiento → 404.
- **Limpieza de la fase 3:** se eliminan las acciones de consola de catálogos (`guardarCatalogoEnFraccionamiento`, `guardarTipoCuotaEnFraccionamiento`) y sus pruebas. Los parámetros opcionales que se agregaron a componentes y queries de catálogos pueden quedarse o quitarse; lo decide quien construye, sin cambiar el comportamiento del administrador.

### 5. Acciones de consola

Nuevas Server Actions con `runSuperAdminAction` y fraccionamiento explícito:

- **Domicilios:**
  - `crearDomicilioEnFraccionamiento(fraccionamientoId, input)`: inserta en `domicilios` y en `domicilio_concepto` con `fraccionamiento_id` explícito y `created_by` = super admin.
  - `actualizarDomicilioEnFraccionamiento(fraccionamientoId, id, input)`: solo dirección, fecha de alta y observaciones; filtra por `id` y `fraccionamiento_id`.
  - Mismas validaciones y mensajes que las acciones del fraccionamiento, incluida la dirección duplicada dentro del fraccionamiento.
- **Residentes:** crear, actualizar y eliminar, con el mismo patrón.
- **Teléfonos y tarjetas:** crear, actualizar y eliminar, con los mismos límites (`LIMITES`) y validaciones.
- **Reutilización:**
  - La lógica de las acciones actuales se mueve a funciones internas que reciben `fraccionamientoId: number | null`. Con `null` se comportan exactamente como hoy.
  - Los componentes reciben las acciones por props, con las actuales como valor por defecto.
  - `EditDomicilioDialog` recibe una prop para ocultar el campo de tipo de cuota.

### 6. Pruebas de la app

- Acciones de consola:
  - un administrador → `MSG_NO_PERMISO`;
  - el super admin crea con el `fraccionamiento_id` del parámetro;
  - las actualizaciones filtran por fraccionamiento;
  - la actualización de domicilio no toca `domicilio_concepto`;
  - el límite de tarjetas y teléfonos se respeta.
- Páginas:
  - un tesorero → 404;
  - un domicilio de otro fraccionamiento → 404;
  - el detalle del domicilio en la consola no renderiza "Cuotas" ni "Pagos extra";
  - la tabla de domicilios de la consola no tiene la columna de estatus;
  - sin tipos de cuota, el botón de nuevo domicilio está deshabilitado con el aviso exacto.
- Inicio: muestra los conteos y la tabla por fraccionamiento a partir de datos simulados.
- Menú: el super admin ve Inicio y Fraccionamientos, con el activo marcado.

## Lo que decide quien construye

- Las consultas exactas de las métricas, dentro de §3.
- Cómo compartir el esqueleto `Sidebar`/`AppBar` entre `(app)` y `/admin` sin duplicarlo.
- Si el detalle del domicilio en la consola extrae un componente común con la página del fraccionamiento o compone las secciones directamente, siempre sin copiar código.
