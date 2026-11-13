import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FilaRegistro } from '../traduccion'

/*
 * Trae exceljs y jsPDF: se importa con `import()` solo al exportar para no cargarlos con la pantalla.
 */

export type MetaRegistros = {
  fraccionamiento: string
  desde: string
  hasta: string
  filtros: string[]
  generadoPor: string
  generadoEn: string
  total: number
  exportados: number
  /** Logo WEADMI como data URL (PNG); `null`/ausente ⇒ PDF sin logo. */
  logo?: string | null
}

export const ENCABEZADOS = ['Fecha y hora', 'Panel', 'Domicilio / Titular', 'Origen', 'Credencial', 'Salida', 'Resultado', 'Motivo']

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const NUM = new Intl.NumberFormat('en-US')

// Colores de la marca (globals.css) en RGB para jsPDF, que no lee CSS; mismos que movimientos.
type Rgb = [number, number, number]
const PDF_NAVY: Rgb = [7, 31, 73]
const PDF_PRIMARIO: Rgb = [8, 107, 184]
const PDF_TEXTO_SECUNDARIO: Rgb = [73, 105, 133]
const EXITO: Rgb = [11, 122, 77]
const PELIGRO: Rgb = [180, 47, 47]

/** `aaaa-mm-dd` ⇒ `dd/mm/aaaa`. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

export function periodo(meta: Pick<MetaRegistros, 'desde' | 'hasta'>): string {
  return `${fechaCorta(meta.desde)} al ${fechaCorta(meta.hasta)}`
}

/** `dd/mm/aaaa HH:mm:ss` ⇒ Date en UTC con la misma hora de pared (sin convertir zona). */
export function fechaHoraExcel(texto: string): Date | string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(texto)
  if (!m) return texto
  const [d, mes, a, h, mi, se] = m.slice(1).map(Number)
  return new Date(Date.UTC(a, mes - 1, d, h, mi, se))
}

function celdas(f: FilaRegistro): string[] {
  return [f.fechaHora, f.panel, f.titular, f.origen, f.credencial, f.salida, f.resultado, f.motivo]
}

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'fraccionamiento'
  )
}

export function nombreArchivo(meta: Pick<MetaRegistros, 'fraccionamiento' | 'desde' | 'hasta'>, ext: 'xlsx' | 'pdf'): string {
  return `registros-acceso-${slug(meta.fraccionamiento)}-${meta.desde}_${meta.hasta}.${ext}`
}

function lineasInfo(meta: MetaRegistros): [string, string][] {
  return [
    ['Fraccionamiento', meta.fraccionamiento],
    ['Periodo', periodo(meta)],
    ['Filtros', meta.filtros.length ? meta.filtros.join(', ') : 'Ninguno'],
    ['Registros exportados', `${NUM.format(meta.exportados)} de ${NUM.format(meta.total)}`],
    ['Generado por', meta.generadoPor],
    ['Generado el', meta.generadoEn],
  ]
}

export async function generarExcel(filas: FilaRegistro[], meta: MetaRegistros): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Registros', { views: [{ state: 'frozen', ySplit: 1 }] })
  const anchos = [20, 14, 34, 16, 18, 16, 12, 24]
  ws.columns = ENCABEZADOS.map((header, i) => ({
    header,
    width: anchos[i],
    ...(i === 0 ? { style: { numFmt: 'dd/mm/yyyy hh:mm:ss' } } : {}),
  }))
  ws.getRow(1).font = { bold: true }
  for (const f of filas) {
    const [fecha, ...resto] = celdas(f)
    ws.addRow([fechaHoraExcel(fecha), ...resto])
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ENCABEZADOS.length } }

  const info = wb.addWorksheet('Información')
  info.columns = [{ width: 24 }, { width: 60 }]
  info.addRow(['Registros de acceso']).font = { bold: true, size: 14 }
  for (const fila of lineasInfo(meta)) info.addRow(fila).getCell(1).font = { bold: true }

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  return new Blob([buf], { type: XLSX })
}

export async function generarPdf(filas: FilaRegistro[], meta: MetaRegistros): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
  const margen = 36
  // Logo arriba a la izquierda (444×92 px ⇒ 116×24 pt); el texto se recorre debajo.
  let y = 46
  if (meta.logo) {
    try {
      doc.addImage(meta.logo, 'PNG', margen, 22, 116, 24)
      y = 70
    } catch {
      // Logo ilegible: se genera sin él.
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...PDF_NAVY)
  doc.text('Registros de acceso', margen, y)
  y += 18
  doc.setFontSize(12).text(meta.fraccionamiento, margen, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...PDF_TEXTO_SECUNDARIO)
  doc.text(`Periodo: ${periodo(meta)}`, margen, y + 18)
  const filtros = meta.filtros.length ? meta.filtros.join(', ') : 'Ninguno'
  doc.text(`Filtros: ${filtros} · ${NUM.format(meta.exportados)} de ${NUM.format(meta.total)} registros`, margen, y + 32)
  doc.text(`Generado por ${meta.generadoPor} el ${meta.generadoEn}`, margen, y + 46)

  autoTable(doc, {
    startY: y + 60,
    margin: { left: margen, right: margen, bottom: 40 },
    head: [ENCABEZADOS],
    body: filas.map(celdas),
    styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
    headStyles: { fillColor: PDF_PRIMARIO, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 92 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor = filas[data.row.index]?.permitido ? EXITO : PELIGRO
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Pie al final para conocer el total de páginas.
  const paginas = doc.getNumberOfPages()
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setTextColor(...PDF_TEXTO_SECUNDARIO)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 20, { align: 'right' })
  }
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
}

// El logo se comparte con otros PDF (movimientos): vive en src/lib/logo-pdf.ts.
export { cargarLogo, LOGO_PDF } from '@/lib/logo-pdf'
