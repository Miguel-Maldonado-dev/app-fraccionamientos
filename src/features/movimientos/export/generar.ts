import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import type { FilaExport, MetaExport } from './datos'

/*
 * Este módulo trae exceljs y jsPDF: se importa con `import()` solo al exportar,
 * para que esas librerías no formen parte de la carga de la pantalla.
 */

const ENCABEZADOS = ['Tipo', 'Descripción', 'Importe', 'Fecha']
const FORMATO_IMPORTE = '"+ "$#,##0.00;"- "$#,##0.00;$0.00'

// Colores de la marca WEADMI (globals.css) en RGB para jsPDF, que no lee CSS.
type Rgb = [number, number, number]
const PDF_NAVY: Rgb = [7, 31, 73] // #071F49
const PDF_PRIMARIO: Rgb = [8, 107, 184] // #086BB8
const PDF_TEXTO_SECUNDARIO: Rgb = [73, 105, 133] // #496985
const EXITO: Rgb = [11, 122, 77] // --success-foreground #0B7A4D
const PELIGRO: Rgb = [180, 47, 47] // --danger-foreground #B42F2F

function fechaExcel(iso: string): Date | string {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return anio && mes && dia ? new Date(Date.UTC(anio, mes - 1, dia)) : ''
}

function importeTexto(importe: number): string {
  return importe < 0 ? `- ${formatMoney(-importe)}` : `+ ${formatMoney(importe)}`
}

export async function crearExcel(filas: FilaExport[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: ENCABEZADOS[0], key: 'tipo', width: 12 },
    { header: ENCABEZADOS[1], key: 'descripcion', width: 60 },
    { header: ENCABEZADOS[2], key: 'importe', width: 16, style: { numFmt: FORMATO_IMPORTE } },
    { header: ENCABEZADOS[3], key: 'fecha', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
  ]
  ws.getRow(1).font = { bold: true }
  for (const f of filas) ws.addRow({ ...f, fecha: fechaExcel(f.fecha) })
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

/** `logo`: data URL PNG del logotipo (ver `cargarLogo`); sin logo el encabezado empieza arriba. */
export function crearPdf(filas: FilaExport[], meta: MetaExport, logo?: string | null): ArrayBuffer {
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
  doc.text(`Movimientos financieros · ${meta.fraccionamientoNombre}`, margen, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...PDF_TEXTO_SECUNDARIO)
  doc.text(`Generado el ${formatDate(meta.generado)}`, margen, y + 18)
  doc.text(meta.filtros, margen, y + 32)

  autoTable(doc, {
    startY: y + 46,
    margin: { left: margen, right: margen },
    head: [ENCABEZADOS],
    body: filas.map((f) => [f.tipo, f.descripcion, importeTexto(f.importe), formatDate(f.fecha)]),
    styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: PDF_PRIMARIO, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right', cellWidth: 90 }, 3: { cellWidth: 70 }, 0: { cellWidth: 60 } },
    didParseCell: (data) => {
      if (data.column.index !== 2) return
      if (data.section === 'head') data.cell.styles.halign = 'right'
      if (data.section === 'body') data.cell.styles.textColor = filas[data.row.index].importe < 0 ? PELIGRO : EXITO
    },
    didDrawPage: () => {
      const alto = doc.internal.pageSize.getHeight()
      const ancho = doc.internal.pageSize.getWidth()
      doc.setFontSize(8).setTextColor(...PDF_TEXTO_SECUNDARIO)
      doc.text(`Página ${doc.getNumberOfPages()}`, ancho - margen, alto - 20, { align: 'right' })
    },
  })

  // Consolidado al final: autoTable deja la tabla anterior en `lastAutoTable`; sin `startY`
  // la nueva empezaría arriba de la página, encima de los movimientos.
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 46
  autoTable(doc, {
    startY: finalY + 20,
    margin: { left: margen, right: margen },
    tableWidth: 260,
    head: [[{ content: 'Consolidado', colSpan: 2 }]],
    body: [
      ['Total de ingresos', formatMoney(meta.totales.ingresos)],
      ['Total de egresos', formatMoney(meta.totales.egresos)],
    ],
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: PDF_PRIMARIO, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = data.row.index === 0 ? EXITO : PELIGRO
      }
    },
    pageBreak: 'avoid',
  })

  return doc.output('arraybuffer')
}
