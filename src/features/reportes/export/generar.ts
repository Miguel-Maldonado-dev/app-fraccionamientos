import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from '@/lib/dates'
import { formatMoney } from '@/lib/format'

/*
 * Exportación del reporte "Pagos por usuario". Trae exceljs y jsPDF: se importa con `import()`
 * solo al exportar, para que esas librerías no formen parte de la carga de la pantalla.
 */

export type FilaPago = { referencia: string; usuario: string; metodo: string; importe: number; fecha: string }

export type MetaPagos = {
  fraccionamiento: string
  usuario: string
  inicio: string
  fin: string
  metodo: string
  generado: string
  total: number
}

export const ENCABEZADOS = ['Referencia', 'Usuario', 'Método de pago', 'Importe', 'Fecha de pago']

// Colores de la marca WEADMI (globals.css) en RGB para jsPDF, que no lee CSS.
type Rgb = [number, number, number]
const PDF_NAVY: Rgb = [7, 31, 73] // #071F49
const PDF_PRIMARIO: Rgb = [8, 107, 184] // #086BB8
const PDF_TEXTO_SECUNDARIO: Rgb = [73, 105, 133] // #496985

function fechaExcel(iso: string): Date | string {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return anio && mes && dia ? new Date(Date.UTC(anio, mes - 1, dia)) : ''
}

function periodo(meta: MetaPagos): string {
  return `${formatDate(meta.inicio)} al ${formatDate(meta.fin)}`
}

export async function crearExcelPagos(filas: FilaPago[], meta: MetaPagos): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Pagos')
  ws.columns = [
    { header: ENCABEZADOS[0], key: 'referencia', width: 40 },
    { header: ENCABEZADOS[1], key: 'usuario', width: 24 },
    { header: ENCABEZADOS[2], key: 'metodo', width: 18 },
    { header: ENCABEZADOS[3], key: 'importe', width: 14, style: { numFmt: '$#,##0.00' } },
    { header: ENCABEZADOS[4], key: 'fecha', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
  ]
  ws.getRow(1).font = { bold: true }
  for (const f of filas) ws.addRow({ ...f, fecha: fechaExcel(f.fecha) })
  const total = ws.addRow({ metodo: 'Total', importe: meta.total })
  total.font = { bold: true }

  const info = wb.addWorksheet('Información')
  info.columns = [
    { key: 'campo', width: 18 },
    { key: 'valor', width: 40 },
  ]
  info.addRows([
    { campo: 'Fraccionamiento', valor: meta.fraccionamiento },
    { campo: 'Usuario', valor: meta.usuario },
    { campo: 'Periodo', valor: periodo(meta) },
    { campo: 'Método de pago', valor: meta.metodo },
    { campo: 'Generado el', valor: formatDate(meta.generado) },
    { campo: 'Pagos', valor: filas.length },
    { campo: 'Total', valor: formatMoney(meta.total) },
  ])
  info.getColumn('campo').font = { bold: true }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

/** `logo`: data URL PNG del logotipo (ver `cargarLogo`); sin logo el encabezado empieza arriba. */
export function crearPdfPagos(filas: FilaPago[], meta: MetaPagos, logo?: string | null): ArrayBuffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const margen = 40
  let y = 50
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margen, 22, 116, 24)
      y += 34
    } catch {
      // Logo ilegible: el PDF sale sin él.
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...PDF_NAVY)
  doc.text(`Pagos por usuario · ${meta.fraccionamiento}`, margen, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...PDF_TEXTO_SECUNDARIO)
  doc.text(`Usuario: ${meta.usuario} · Periodo: ${periodo(meta)} · Método: ${meta.metodo}`, margen, y + 18)
  doc.text(`Generado el ${formatDate(meta.generado)}`, margen, y + 32)

  autoTable(doc, {
    startY: y + 46,
    margin: { left: margen, right: margen },
    head: [ENCABEZADOS],
    body: filas.map((f) => [f.referencia, f.usuario, f.metodo, formatMoney(f.importe), formatDate(f.fecha)]),
    // Total al final de la tabla (solo en la última página, como pie).
    foot: [[{ content: 'Total', colSpan: 3 }, formatMoney(meta.total), '']],
    showFoot: 'lastPage',
    styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: PDF_PRIMARIO, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [232, 238, 244], textColor: PDF_NAVY, fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right', cellWidth: 80 }, 4: { cellWidth: 72 } },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section !== 'body') data.cell.styles.halign = 'right'
    },
    didDrawPage: () => {
      const alto = doc.internal.pageSize.getHeight()
      const ancho = doc.internal.pageSize.getWidth()
      doc.setFontSize(8).setTextColor(...PDF_TEXTO_SECUNDARIO)
      doc.text(`Página ${doc.getNumberOfPages()}`, ancho - margen, alto - 20, { align: 'right' })
    },
  })

  return doc.output('arraybuffer')
}
