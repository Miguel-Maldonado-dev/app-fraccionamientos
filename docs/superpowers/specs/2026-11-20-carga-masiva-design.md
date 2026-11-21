# Carga masiva (domicilios, residentes, tarjetas, controles) — Diseño

Estado: listo para aprobación (2026-11-20).

## 1. Intención
Al dar de alta un fraccionamiento nuevo, el super admin necesita cargar de una vez todos sus domicilios,
el residente principal de cada uno (con cuenta de la app) y las tarjetas y controles que ya traían de
su sistema anterior. También debe poder **exportar** esos datos en el mismo formato, por ejemplo para
entregarlos al fraccionamiento al terminar el contrato. Se usa sobre todo una vez, pero queda
disponible para repetirse.

## 2. Metas / no metas / anti-metas
- Metas: 3 importaciones (domicilios+residente, tarjetas, controles) desde `.xlsx` o `.csv`, con
  plantilla, **vista previa** y confirmación; 3 exportaciones con el mismo formato; creación de cuentas
  de la app con contraseña temporal y **archivo de credenciales** (Excel y PDF) por domicilio.
- No metas: actualizar o borrar datos existentes desde el archivo; importar PIN, cuotas, pagos o
  residentes no principales; proceso en segundo plano; uso por el administrador del fraccionamiento.
- Anti-metas: nunca duplicar un domicilio, tarjeta o control; nunca guardar contraseñas temporales en
  el sistema; nunca crear datos en otro fraccionamiento; una fila mala no bloquea las buenas.

## 3. Enfoques (elegido A)
- **A (elegido):** el navegador envía las filas confirmadas al servidor en bloques (~50) con barra de
  avance; cada bloque devuelve sus resultados y contraseñas; el archivo de credenciales se genera en el
  navegador. No se guardan contraseñas. Si se cierra la pestaña, recargar el archivo continúa (lo
  existente se omite); las cuentas ya creadas sin credencial entregada se listan para restablecer.
- B: importación en segundo plano — descartado: obligaría a guardar contraseñas y es más trabajo.

## 4. Diseño

### 4.1 Dónde y quién
- Consola del super admin, detalle del fraccionamiento, pestaña nueva **"Carga masiva"** con tres
  bloques: Domicilios y residentes · Tarjetas · Controles. Cada bloque: "Descargar plantilla",
  "Importar archivo", "Exportar (Excel/CSV)". Solo super admin (validación en servidor).
- Orden recomendado (texto en pantalla): primero domicilios; tarjetas y controles necesitan que el
  domicilio exista.

### 4.2 Formatos (encabezados exactos, sin distinguir mayúsculas/acentos; primera hoja del Excel)
1. **Domicilios:** `direccion` (obligatoria), `residente`, `telefono`, `tipo_cuota`, `fecha_alta`,
   `observaciones`.
   - `direccion`: se normaliza como hoy (trim, mayúsculas).
   - `telefono`: 10 dígitos con la misma normalización de la web; requiere `residente`.
   - `residente` sin `telefono`: se crea el residente principal **sin cuenta**.
   - `tipo_cuota`: nombre de un tipo de cuota del catálogo del fraccionamiento (sin distinguir
     mayúsculas); vacío ⇒ sin tipo de cuota.
   - `fecha_alta`: `AAAA-MM-DD` o `DD/MM/AAAA` o fecha de Excel; vacía ⇒ hoy.
2. **Tarjetas:** `direccion`, `tarjeta`, `descripcion` (opcional). Una fila por tarjeta. `tarjeta`
   decimal 0–4294967295 (regla existente).
3. **Controles:** `direccion`, `boton1`, `boton2`, `boton3`, `boton4`, `descripcion` (opcional). Una
   fila por control; al menos un botón; cada botón = código RF decimal; se guarda como `botones`
   `[{boton: 0..3, rf_code}]` según `private.botones_control_validos`.

### 4.3 Vista previa (antes de guardar nada)
- El servidor lee el archivo, valida cada fila y responde una lista por fila con estado:
  **Crear**, **Omitir** (ya existe) o **Error** (motivo). Resumen: "120 a crear · 3 omitidas · 2 con
  error". Errores típicos: dirección vacía, teléfono inválido, tipo de cuota inexistente, tarjeta o
  control con dirección inexistente, número inválido, duplicado dentro del mismo archivo.
- **Duplicados existentes:** domicilio con la misma dirección ⇒ Omitir + advertencia "revisar
  manualmente" (no se toca su residente); tarjeta con el mismo número en el fraccionamiento ⇒ Omitir;
  control con los mismos códigos RF en el mismo domicilio ⇒ Omitir.
- Botón "Descargar errores" (CSV con las filas y su motivo). "Confirmar importación" crea solo las
  filas en **Crear**.

### 4.4 Ejecución
- Bloques de ~50 filas, secuenciales, con progreso "Importando… 100 de 320". Cada bloque se procesa con
  validación de super admin y el `fraccionamiento_id` de la ruta; vuelve a validar cada fila (lo que
  apareció mientras tanto se omite).
- Domicilio: mismas reglas y efectos que crearlo desde la consola (incluye `domicilio_concepto` si hay
  tipo de cuota y la sincronización con access-core vía la cola existente).
- Residente principal con teléfono: crea o **vincula** la cuenta como el alta actual de residentes:
  - teléfono sin cuenta ⇒ cuenta nueva con **contraseña temporal** (10 caracteres, letras y números sin
    ambiguos como 0/O, 1/l);
  - teléfono con cuenta existente ⇒ se vincula; credencial "Cuenta existente, usa su contraseña actual".
- Tarjetas y controles: mismas reglas que el alta manual; se encola su sincronización.
- Al terminar: resumen (creados, omitidos, errores, advertencias) y, si hubo cuentas, el **archivo de
  credenciales**.

### 4.5 Archivo de credenciales
- Se genera en el navegador con lo devuelto por los bloques; formatos **Excel y PDF**.
- Columnas: Domicilio · Residente · Usuario (teléfono) · Contraseña temporal (o "Cuenta existente").
- PDF: logo WEADMI, fraccionamiento, fecha, aviso "Contraseñas temporales: el residente puede cambiarla
  en la app (Cuenta → Cambiar contraseña). Este documento es confidencial." y numeración de páginas.
- Aviso en pantalla antes de cerrar: "Descarga el archivo ahora; las contraseñas no se pueden volver a
  consultar."

### 4.6 Exportaciones
- Domicilios: mismas columnas que la importación, con el residente principal (si hay varios principales,
  el primero) y su teléfono; sin contraseñas.
- Tarjetas y controles: mismas columnas; un renglón por tarjeta o control.
- Formatos Excel y CSV; nombre `carga-<tipo>-<fraccionamiento>-<fecha>`.

## 5. Decisiones del usuario
- Super admin, en una sección "Carga masiva"; uso principal al crear el fraccionamiento, reutilizable.
- Formatos: domicilios `direccion, residente, telefono` + `tipo_cuota, fecha_alta, observaciones`;
  tarjetas `direccion, tarjeta`; controles `direccion, boton1..boton4`; exportación en el mismo formato.
- Domicilio repetido ⇒ se omite y se advierte para revisión manual.
- Con nombre y teléfono se crea la cuenta de la app con contraseña temporal; archivo Excel/PDF de
  credenciales por domicilio.
- Enfoque A.

## 6. Decisiones mías (corregibles)
- Vista previa obligatoria; filas con error no bloquean las demás; CSV de errores.
- Columnas `descripcion` opcionales en tarjetas y controles.
- Teléfono con cuenta existente se vincula sin nueva contraseña.
- Contraseña temporal de 10 caracteres sin ambiguos; no se obliga a cambiarla.
- Excel: primera hoja; encabezados sin distinguir mayúsculas ni acentos.

## 7. Para el constructor
Librería de lectura (exceljs ya está; CSV con parser propio o librería pequeña con versión exacta),
tamaño de bloque, límites de archivo (sugerido 5 MB / 5,000 filas), componentes de UI, pruebas.

## 8. Respuestas a la revisión del constructor (decisiones mías)
- **Teléfono con cuenta existente (incluso de otro fraccionamiento):** se vincula, igual que el alta
  actual (`obtenerOCrearCuenta`); la vista previa lo marca como advertencia "Cuenta existente: se
  vinculará" y la credencial dice "Cuenta existente, usa su contraseña actual".
- **Mismo teléfono en varios domicilios del archivo:** válido. La primera fila crea la cuenta (con
  contraseña) y las siguientes la vinculan; en credenciales aparecen todas las filas, la contraseña solo
  en la primera y en las demás "Misma cuenta que <dirección>".
- **Fallos a medias:** no se guarda estado. El resultado de cada bloque informa por fila; si una cuenta se
  creó pero el resto de la fila falló, el resumen final y el CSV de resultados la marcan "Cuenta creada
  sin credencial: restablecer contraseña desde el detalle del domicilio" (se usa el restablecer existente,
  sin UI nueva).
- **Cliente y permisos:** reutilizar las mutaciones de la consola del super admin (las mismas que crean
  domicilios, residentes, tarjetas y controles hoy con `fraccionamientoId`), con validación
  `requireSuperAdmin`; el constructor confirma que la RLS permite al super admin cada inserción y, si
  alguna no, usa el patrón existente de validar primero y luego service-role.
- **Sincronización:** se encola por fila como hoy, pero se **dispara** la cola una sola vez por bloque.
  Si el fraccionamiento no tiene instalación, se comporta como el alta manual hoy (sin instalación no se
  encola; al asignarla, el flujo existente sincroniza).
- **Cambio obligatorio de contraseña (decisión del usuario):** solo las cuentas **creadas por la carga
  masiva con contraseña temporal** quedan marcadas "debe cambiar contraseña" (marca del lado del servidor,
  p. ej. `app_metadata.debe_cambiar_password = true` o columna en `cuentas_residente`; la decide el
  constructor, no editable por el residente). Las cuentas vinculadas o creadas por otros flujos no se
  marcan. La app móvil, tras iniciar sesión con la marca activa, muestra la pantalla **"Crea tu
  contraseña"** (nueva contraseña + confirmar, mínimo 8, distinta de la temporal) y no deja continuar
  hasta guardarla; al guardarla el servidor quita la marca. Los endpoints `/api/app/*` responden 403
  `{ codigo: 'cambiar_password' }` mientras la marca esté activa (salvo el de cambiar contraseña), para
  que no se pueda saltar la pantalla.
