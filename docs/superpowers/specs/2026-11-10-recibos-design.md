# Recibos sin PDF almacenado: diseño

Fecha: 2026-11-10 · Estado: aprobado (2026-11-10) · Parte 1 de la fase 4 del spec multi-tenant (`2026-11-09-multitenant-design.md`).

## Objetivo

Hoy, al registrar un pago, la app pide el PDF del recibo a la edge function `generar-recibo-b64` y guarda el PDF completo en base64 en `pagos.file_data`. Hay dos problemas:

- La edge function solo existe en el proyecto de Lago Amadeo, así que en el proyecto nuevo los pagos se guardan sin recibo.
- Guardar el PDF en la base no escala: decenas de KB por pago, multiplicados por pagos, meses y fraccionamientos.

El usuario quiere que el recibo se genere en el momento a partir de datos mínimos.

**Éxito:**

- Cada pago guarda solo un JSON pequeño con lo que lleva el recibo.
- El PDF se genera cada vez que alguien lo abre.
- El recibo de un pago nunca cambia, aunque después cambien el residente o un concepto.
- La impresión en la térmica de 58 mm sigue funcionando igual en las casetas.

## No objetivos y anti-objetivos

- **Fuera de alcance:**
  - Imprimir en ESC/POS directo a la impresora. Queda como mejora posterior, porque implica reemplazar el servidor de impresión local de cada caseta.
  - Cambiar el servidor de impresión actual (Python + Sumatra en `localhost:8000/print`, que recibe `{ pdf_base64 }`).
  - Migrar recibos de Lago Amadeo; el proyecto nuevo arranca vacío.
- **Anti-objetivos:**
  - Que un recibo reimpreso muestre datos distintos a los del momento del pago.
  - Volver a guardar archivos binarios en la base.
  - Que registrar un pago falle por un problema del recibo.

## Enfoques considerados

**Qué se guarda:**

- **A. Nada; armar el recibo con los datos actuales.** Es lo más ligero, pero el recibo no sería inmutable.
- **B. Una foto JSON al registrar el pago (elegido).** Ocupa unos 300 bytes, es inmutable y se genera al vuelo.

**Cómo se imprime:**

- **I. PDF al vuelo con el servidor de impresión actual (elegido).** No cambia nada en las casetas.
- **II. ESC/POS directo.** Es más nítido, pero obliga a reescribir e instalar un servidor nuevo en cada caseta.
- **III. Impresión silenciosa desde Chrome.** No necesita servidor, pero hay que configurar cada PC y la calidad en 58 mm es menos fiable.

El usuario eligió **B + I** el 2026-11-10.

## Diseño

### 1. Base de datos (migración nueva)

- `alter table public.pagos add column recibo jsonb`. La columna puede ser nula, pero toda inserción de la app la llena.
- Se recrean `pagos_info` y `reporte_pagos_detalle` (las mismas columnas, `security_invoker` y permisos) cambiando `p.file_data` por `p.recibo is not null as tiene_recibo`. Después, `alter table public.pagos drop column file_data`. El proyecto nuevo no tiene datos que perder.
- Las pruebas pgTAP que mencionan `file_data` o las columnas de esas vistas se actualizan.
- Los tipos se regeneran (`supabase gen types typescript --local`).

### 2. Contenido del JSON (`ReciboDatos`, versión 1)

```ts
type ReciboDatos = {
  v: 1
  fraccionamiento: string      // nombre del fraccionamiento al momento del pago
  direccion: string
  residente: string            // residente principal o 'Sin información'
  concepto: string
  periodo?: string             // 'Ene/2026', solo en pagos de cuota
  fechaVencimiento?: string    // 'dd/MM/yyyy', solo en pagos de cuota
  fechaPago: string            // 'dd/MM/yyyy'
  subtotal: number             // pesos
  recargo?: number
  descuento?: number
  total: number
}
```

- Es el mismo contenido del ticket anterior, más `fraccionamiento`.
- **La `referencia` no va en el JSON** (decisión de diseño). La genera la base (`default gen_random_uuid()`) y la ruta la toma de la columna `pagos.referencia`. Así el JSON se arma antes del `insert` sin cambiar cómo se crea el pago.
- **Origen de los importes (decisión de diseño):**
  - Pago de cuota: `subtotal` = `importe_cuota − recargo + descuento`, es decir, el importe copiado a la cuota al generarla. No se usa `importe_base`, que es el precio vigente del concepto y puede haber cambiado (corrección tras la revisión final); `recargo` = `monto_recargo` y `descuento` = `monto_descuento`, que se omiten cuando valen 0; `total` = `importe_cuota`, el mismo importe que se guarda en el pago.
  - Pago extra: `subtotal` = `total` = `concepto.importe`, sin recargo ni descuento.
- **`fraccionamiento`** sale de `getTenantContext().fraccionamiento.nombre`. `runAction` solo ejecuta la acción para usuarios con fraccionamiento activo, así que nunca es nulo ahí.
- Se valida con un esquema Zod (`reciboDatosSchema`) al leerlo, para tolerar datos corruptos o de una versión futura: si no valida, la ruta responde 404 "Recibo no disponible".
- Un pago creado antes de este cambio, sin `recibo` (solo en la base local de desarrollo), responde 404. Es aceptable porque el proyecto nuevo arranca vacío.

### 3. Registrar pago (`src/features/pagos/actions.ts`)

- `registrarPagoCuota` y `registrarPagoExtra` arman `ReciboDatos` con los datos que ya consultan (cuota, domicilio, concepto) más el nombre del fraccionamiento del usuario (`getTenantContext`). Lo incluyen en el mismo `insert` del pago, así no hay un segundo `update` que pueda fallar.
- Desaparecen `generarReciboBase64`, `guardarRecibo`, el campo `reciboGenerado` del resultado y el aviso `MSG_SIN_RECIBO` en los diálogos.
- Ningún componente usa `file_data` para mostrar el botón de recibo; el botón se sigue mostrando siempre. `tiene_recibo` queda disponible en las vistas para usos futuros.
- `src/lib/supabase/functions.ts` (`invokeEdgeFunction`) y su prueba se eliminan, porque ya no tienen usos.

### 4. Generación del PDF (`src/features/pagos/recibo-pdf.ts`)

- `generarReciboPdf(datos: ReciboDatos, referencia: string): Promise<Uint8Array>`, del lado del servidor, con **jsPDF** (ya es dependencia). Si jsPDF no corre en el runtime Node de la ruta, se permite usar `pdf-lib` en su lugar.
- **QR:** con la librería `qrcode` (versión fija). Codifica la `referencia` como imagen PNG, en blanco y negro.
- **Formato del ticket:**
  - Ancho de 58 mm (164 pt) y alto calculado según el contenido, para no dejar papel en blanco.
  - Márgenes de 8 pt, Helvetica y todo en negro.
- **Contenido, en este orden:**

  ```
  [logotipo WEADMI]            (centrado, ancho del área útil)
  <FRACCIONAMIENTO>            (negrita, centrado)
  RECIBO DE PAGO               (negrita, centrado)
  ─────────────
  Dirección: …
  Residente: …
  Periodo: …                   (si existe)
  Concepto: …
  Vencimiento: …               (si existe)
  Fecha de pago: …
  ─────────────
  Subtotal          $X
  + Recargo         $X         (si existe)
  − Descuento       $X         (si existe)
  TOTAL             $X         (negrita)
  ─────────────
  [QR]
  Referencia: <uuid>           (texto chico, puede ocupar 2 líneas)
  Gracias por su pago
  WEADMI · Gestión residencial (texto chico)
  ```

- **Logotipo (pedido del usuario):** al inicio va el mismo logotipo del menú lateral, `public/brand/weadmi-logotipo.png`.
  - Se dibuja centrado, con el ancho del área útil (148 pt) y el alto en proporción 1047:217 (unos 31 pt).
  - Se lee del disco una sola vez y se guarda en memoria del servidor.
  - Al desplegar, el archivo debe incluirse en el paquete de la ruta (por ejemplo con `outputFileTracingIncludes` en `next.config.ts`).
  - En la térmica saldrá en escala de grises; no se crea una versión especial.
  - Si el archivo no se puede leer, el recibo se genera sin logo y se registra el error en el log; el recibo nunca falla por el logo.
- **Importes:** con el formato de moneda de la app (`$1,234.50`).
- **Textos largos:** dirección, residente y concepto se ajustan a varias líneas, nunca se cortan.

### 5. Ruta `GET /api/recibos/[pagoId]`

- Misma autenticación que hoy (usuario activo de un fraccionamiento).
- Lee `referencia, recibo` del pago con el cliente de sesión, así que RLS decide quién lo ve. Valida el JSON, genera el PDF y lo responde con los mismos headers de hoy (`inline; filename="<referencia>.pdf"`, `private, no-store`).
- Sin recibo o con JSON inválido: 404 "Recibo no disponible".
- El diálogo del recibo, la descarga y el envío al servidor de impresión no cambian; siguen recibiendo un PDF.

### 6. Pruebas

- `generarReciboPdf`:
  - Devuelve bytes que empiezan con `%PDF`.
  - Incluye una imagen (el logotipo) y, si falla la lectura del logo, igual genera el PDF.
  - Con y sin `periodo`, `recargo` y `descuento`.
  - Una dirección de 120 caracteres no lanza.
  - El alto de la página crece con el contenido.
- `reciboDatosSchema`: acepta la versión 1 y rechaza un objeto sin `total` o con `v: 2`.
- Acciones:
  - El `insert` del pago incluye `recibo` con los valores esperados (pago de cuota con recargo y descuento, y pago extra).
  - Ya no se llama ninguna edge function.
- Ruta:
  - 401 sin sesión.
  - 404 sin recibo.
  - 404 con JSON inválido.
  - 200 con `application/pdf` y el nombre de archivo saneado.
- pgTAP: las vistas exponen `tiene_recibo` y ya no `file_data`.

## Lo que decide quien construye

- La librería exacta del QR, si `qrcode` presenta problemas en el servidor (debe tener versión fija y licencia permisiva).
- La tipografía y los espaciados finos del ticket, mientras quepa en 58 mm y sea legible en una térmica.
