import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { formatMoney } from '@/lib/format'
import type { ReciboDatos } from './datos'

const ANCHO = 164 // 58 mm
const MARGEN = 8
const UTIL = ANCHO - MARGEN * 2 // 148
const LOGO_ALTO = Math.round((UTIL * 217) / 1047) // ~31
const QR = 72
const INTERLINEA = 1.2

type Doc = jsPDF

/** Una etiqueta en negrita seguida del valor, ajustado a varias líneas. */
function campo(doc: Doc, y: number, etiqueta: string, valor: string, dibujar: boolean): number {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const ancho = doc.getTextWidth(`${etiqueta} `)
  doc.setFont('helvetica', 'normal')
  const lineas = doc.splitTextToSize(valor, UTIL - ancho) as string[]
  if (dibujar) {
    doc.setFont('helvetica', 'bold')
    doc.text(etiqueta, MARGEN, y)
    doc.setFont('helvetica', 'normal')
    doc.text(lineas[0] ?? '', MARGEN + ancho, y)
    // Las líneas siguientes usan todo el ancho útil.
    const resto = doc.splitTextToSize(lineas.slice(1).join(' '), UTIL) as string[]
    resto.forEach((l, i) => doc.text(l, MARGEN, y + (i + 1) * 8 * INTERLINEA))
  }
  const resto = lineas.length > 1 ? (doc.splitTextToSize(lineas.slice(1).join(' '), UTIL) as string[]).length : 0
  return y + (1 + resto) * 8 * INTERLINEA + 2
}

function linea(doc: Doc, y: number, dibujar: boolean): number {
  if (dibujar) {
    doc.setLineWidth(0.5)
    doc.line(MARGEN, y, ANCHO - MARGEN, y)
  }
  return y + 7
}

// Helvetica estándar no trae U+2212 (jsPDF pasa a modo Unicode y rompe los acentos): se usa el guion ASCII.
function importe(doc: Doc, y: number, etiqueta: string, valor: number, dibujar: boolean, negrita = false): number {
  const tam = negrita ? 10 : 8
  if (dibujar) {
    doc.setFontSize(tam)
    doc.setFont('helvetica', negrita ? 'bold' : 'normal')
    doc.text(etiqueta, MARGEN, y)
    doc.text(formatMoney(valor), ANCHO - MARGEN, y, { align: 'right' })
  }
  return y + tam * INTERLINEA + 1
}

/** Recorre el ticket; con `dibujar` falso solo mide. Devuelve la posición final (alto de la página). */
function recorrer(
  doc: Doc,
  datos: ReciboDatos,
  conLogo: boolean,
  dibujar: boolean,
  referencia = '',
): { alto: number; qrY: number } {
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(0, 0, 0)
  let y = MARGEN
  if (conLogo) y += LOGO_ALTO + 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  const nombre = doc.splitTextToSize(datos.fraccionamiento, UTIL) as string[]
  if (dibujar) nombre.forEach((l, i) => doc.text(l, ANCHO / 2, y + 8 + i * 12, { align: 'center' }))
  y += nombre.length * 12 + 2
  if (dibujar) doc.text('RECIBO DE PAGO', ANCHO / 2, y + 8, { align: 'center' })
  y += 14

  y = linea(doc, y, dibujar)
  y += 6
  y = campo(doc, y, 'Dirección:', datos.direccion, dibujar)
  y = campo(doc, y, 'Residente:', datos.residente, dibujar)
  if (datos.periodo) y = campo(doc, y, 'Periodo:', datos.periodo, dibujar)
  y = campo(doc, y, 'Concepto:', datos.concepto, dibujar)
  if (datos.fechaVencimiento) y = campo(doc, y, 'Vencimiento:', datos.fechaVencimiento, dibujar)
  y = campo(doc, y, 'Fecha de pago:', datos.fechaPago, dibujar)

  y = linea(doc, y, dibujar)
  y += 6
  y = importe(doc, y, 'Subtotal', datos.subtotal, dibujar)
  if (datos.recargo) y = importe(doc, y, '+ Recargo', datos.recargo, dibujar)
  if (datos.descuento) y = importe(doc, y, '- Descuento', datos.descuento, dibujar)
  y += 3
  y = importe(doc, y, 'TOTAL', datos.total, dibujar, true)

  y = linea(doc, y, dibujar)
  y += 4
  const qrY = y
  y += QR + 6

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  const ref = doc.splitTextToSize(`Referencia: ${referencia || '0'.repeat(36)}`, UTIL) as string[]
  if (dibujar) ref.forEach((l, i) => doc.text(l, ANCHO / 2, y + 6 + i * 8, { align: 'center' }))
  y += ref.length * 8 + 4
  if (dibujar) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Gracias por su pago', ANCHO / 2, y + 7, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('WEADMI · Gestión residencial', ANCHO / 2, y + 17, { align: 'center' })
  }
  return { alto: y + 17 + MARGEN, qrY }
}

/** Alto en pt del ticket, medido sin dibujar. */
export function medirRecibo(datos: ReciboDatos, conLogo: boolean): number {
  const doc = new jsPDF({ unit: 'pt', format: [ANCHO, 2000] })
  return Math.ceil(recorrer(doc, datos, conLogo, false).alto)
}

export async function generarReciboPdf(
  datos: ReciboDatos,
  referencia: string,
  logo?: string | null,
  opciones?: { comprimir?: boolean },
): Promise<Uint8Array> {
  const conLogo = Boolean(logo)
  const alto = medirRecibo(datos, conLogo)
  const doc = new jsPDF({ unit: 'pt', format: [ANCHO, alto], compress: opciones?.comprimir ?? true })
  // Dibuja con el mismo recorrido que la medición.
  const { qrY } = recorrer(doc, datos, conLogo, true, referencia)

  if (logo) doc.addImage(logo, 'PNG', MARGEN, MARGEN, UTIL, LOGO_ALTO, undefined, 'FAST')

  const qr = await QRCode.toDataURL(referencia, {
    margin: 0,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  doc.addImage(qr, 'PNG', (ANCHO - QR) / 2, qrY, QR, QR, undefined, 'FAST')

  return new Uint8Array(doc.output('arraybuffer'))
}
