# Registros de acceso (logs de access-core) — Diseño

Estado: aprobado (2026-11-13).

## 1. Intención

Consultar y exportar los registros de entradas/salidas que generan los paneles de access-core, para
**atender incidentes** y **entregar información a seguridad pública** cuando la solicita. Usuarios:
administrador del fraccionamiento y super admin.

## 2. Metas, no metas, anti-metas

Metas
- Ver registros de un fraccionamiento con filtros, paginados (50 por página, como la API).
- Exportar a Excel y PDF el rango filtrado completo (todas las páginas), con encabezado formal.
- Disponible para administrador (su fraccionamiento) y super admin (cualquiera, desde la consola).

No metas
- Guardar/copiar los logs en nuestra base (se leen en vivo de access-core).
- Tiempo real, alertas, gráficas, registros desde la app móvil.
- Cambiar la sincronización existente.

Anti-metas
- La llave de access-core nunca llega al navegador (server-only).
- El tesorero no ve registros. Un administrador nunca ve registros de otro fraccionamiento.
- Una exportación no debe pasar el límite de la API (120 peticiones/min) ni colgar la página sin aviso.

## 3. Enfoques (elegido A)

- **A (elegido por el usuario): dentro de "Accesos"**, con pestañas "Registros" y "Sincronización". Admin:
  menú Accesos (`/accesos`). Super admin: pestaña Accesos del fraccionamiento en la consola
  (`/admin/fraccionamientos/[id]?tab=accesos`). Todo el control de acceso en un lugar.
- B: pestaña en Reportes — descartado: separa los registros de su contexto y el super admin no tiene
  Reportes en la consola.

## 4. Diseño

### 4.1 Fuente de datos
`GET /installations/{instalacion_id}/logs` con filtros `desde`, `hasta` (AAAA-MM-DD), `panel`, `titular`,
`resultado` (`permitido|denegado`), `origen` (`0..5`), `pagina`. Respuesta `{ data: Log[], page,
page_size (50), total }`, más reciente primero. Paneles para el filtro: `GET /installations/{id}/panels`
(`id`, `panel_code`). Sin `instalacion_id` ⇒ mensaje "Este fraccionamiento no tiene instalación de
access-core." (igual que Sincronización).

### 4.2 Campos mostrados (columnas)
| Columna | Origen |
|---|---|
| Fecha y hora | `ts`, en hora local del fraccionamiento (America/Mexico_City si no hay otra), `dd/mm/aaaa HH:mm:ss` |
| Panel | `panel_code` |
| Domicilio / titular | si `holder_id` = `domicilios.titular_id` de un domicilio del fraccionamiento ⇒ dirección; si no, `holder_name`; si nulo, "—" |
| Origen | `source`: 0 Tarjeta, 1 Control, 2 Botón de salida, 3 PIN, 4 Remota (app), 5 Prueba |
| Credencial | `credential_label`; si nulo y hay `code`, el código; si no, "—" |
| Salida | `output_alias` o "Salida {output_index}" o "—" |
| Resultado | `allowed` ⇒ "Permitido" (verde) / "Denegado" (rojo) |
| Motivo | `reason`: 0 Permitido, 1 Tarjeta desconocida, 2 Sin salida, 3 Sin permiso, 4 Error de comunicación, 5 Control desconocido, 6 Botón sin salida, 7 Botón de salida, 8 PIN desconocido, 9 PIN no permitido, 10 PIN bloqueado, 11 Titular desconocido |

Los diccionarios de origen y motivo viven en un solo módulo y los usan tabla y exportaciones.

### 4.3 Filtros
- Desde / Hasta: obligatorios; por omisión hoy–hoy; máximo **31 días** (error de validación si se excede
  o si desde > hasta).
- Domicilio (selector de domicilios del fraccionamiento ⇒ `titular` = su `titular_id`; domicilios sin
  titular sincronizado no aparecen).
- Panel (de `/panels`), Resultado (Todos/Permitido/Denegado), Origen (Todos + 6 opciones).
- Los filtros viven en la URL (`searchParams`), como Reportes; "Limpiar" vuelve a hoy.

### 4.4 Pantalla
- Pestañas "Registros" (primera, por omisión para administrador y super admin) y "Sincronización"
  (contenido actual sin cambios). El tesorero solo ve Sincronización (sin pestañas visibles).
- Barra de filtros, total ("1,234 registros"), tabla (estilo de la tabla de Domicilios), paginación
  anterior/siguiente con "Página X de Y". Vacío: "No hay registros con estos filtros."
- Errores de la API: 429 ⇒ "Demasiadas consultas, espera un momento"; otros ⇒ "No se pudieron cargar los
  registros" con Reintentar.

### 4.5 Exportar
- Botón "Exportar" con menú Excel / PDF. Exporta el rango filtrado **completo**: el servidor recorre las
  páginas (secuencial) hasta `total`, con **tope de 5,000 registros** (100 páginas); si `total` > 5,000 se
  avisa antes "Se exportarán los primeros 5,000 de N registros; reduce el rango para obtener todos".
- El navegador conduce la exportación **página por página**: una server action por página (valida rol y
  fraccionamiento, trae una página y la devuelve traducida, 4.2), con progreso "Exportando… 20 de 100".
  Así ninguna llamada al servidor tarda más de unos segundos (sin depender de `maxDuration`). El
  archivo se genera en el navegador con `exceljs` / `jsPDF + autotable` cargados con `import()` (mismo
  patrón que `src/features/movimientos/export/`). Mientras exporta: botón deshabilitado con
  "Exportando…".
- Si access-core responde 429 a media exportación: esperar `Retry-After` (máx. 10 s) y reintentar una vez;
  si vuelve a fallar, error "No se pudo completar la exportación, intenta de nuevo".
- **PDF** (horizontal, carta): logo WEADMI, título "Registros de acceso", fraccionamiento, periodo,
  filtros aplicados, "Generado por <nombre/correo> el <fecha hora>", total exportado; tabla con las
  columnas de 4.2; pie "Página X de Y". **Excel**: hoja "Registros" con las mismas columnas (fecha como
  fecha real), y hoja "Información" con fraccionamiento, periodo, filtros, generado por/fecha y total.
- Nombre de archivo: `registros-acceso-<fracc-slug>-<desde>_<hasta>.xlsx|pdf`.

### 4.6 Permisos
- Server actions/consultas: `requireRole(ADMINISTRADOR)` limitado a su fraccionamiento, o super admin con
  el `fraccionamiento_id` explícito. Tesorero ⇒ 404/oculto. Validación con el cliente RLS antes de usar la
  llave de access-core (patrón existente).

## 5. Decisiones del usuario
- Ubicación A (Accesos, pestañas Registros/Sincronización), también en la consola del super admin.
- Uso: incidentes y solicitudes de seguridad pública ⇒ PDF formal.
- Rango máximo 31 días; exportación completa con tope de 5,000.
- Solo administrador y super admin.

## 6. Decisiones mías (corregibles)
- Columnas, textos de origen/motivo, zona horaria por omisión America/Mexico_City.
- Sin caché de logs; cada consulta va a access-core.
- Domicilio se resuelve por `titular_id`; personas/otros titulares muestran `holder_name`.

## 7. Para el constructor
Estructura de archivos (sugerido `src/features/registros-acceso/`), componentes de UI, estilos, cómo
reutilizar `PanelSincronizacion` dentro de la pestaña, pruebas.

## 8. Respuestas a la revisión del constructor (decisiones mías)
- **Zona horaria (confirmado por el usuario):** access-core trabaja en la hora local del panel, tanto en
  `ts` como en `desde`/`hasta`. Se envían los días tal cual y la fecha/hora se muestra **tal como viene en
  `ts`** (hora de pared del panel, sin convertir zona); si `ts` trae desfase, se respeta la hora de pared
  que indica. Esto reemplaza "America/Mexico_City" de 4.2.
- **Titulares tipo persona:** se muestra `holder_name`; el filtro "Domicilio" solo cubre titulares tipo
  domicilio (`domicilios.titular_id`). Sin tabla de mapeo nueva.
- **Exportación:** página por página desde el navegador (4.5).
- **Aislamiento:** `fraccionamientos.instalacion_id` es único (`fraccionamientos_instalacion_id_key`), así que
  una instalación pertenece a un solo fraccionamiento.
- **URL:** admin `/accesos?vista=registros|sincronizacion`; consola
  `/admin/fraccionamientos/[id]?tab=accesos&vista=…`. Filtros: `desde, hasta, domicilio, panel, resultado,
  origen, pagina`.
