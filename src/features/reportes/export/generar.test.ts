// @vitest-environment node
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { describe, expect, it, vi } from 'vitest'
import { crearExcelPagos, crearPdfPagos, ENCABEZADOS, type FilaPago, type MetaPagos } from './generar'

const filas: FilaPago[] = [
  { referencia: 'abc-1', usuario: 'Admin Demo', metodo: 'Efectivo', importe: 500, fecha: '2026-11-12' },
  { referencia: 'abc-2', usuario: 'Admin Demo', metodo: 'Transferencia', importe: 250.5, fecha: '2026-11-13' },
]
const meta: MetaPagos = {
  fraccionamiento: 'Fracc Demo',
  usuario: 'Admin Demo',
  inicio: '2026-11-01',
  fin: '2026-11-13',
  metodo: 'Todos los métodos',
  generado: '2026-11-13',
  total: 750.5,
}
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

describe('crearExcelPagos', () => {
  it('hoja Pagos con encabezados, filas y total; hoja Información', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await crearExcelPagos(filas, meta))
    const ws = wb.getWorksheet('Pagos')!
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(ENCABEZADOS)
    expect(ws.getRow(2).getCell(4).value).toBe(500)
    expect(ws.getRow(2).getCell(5).value).toBeInstanceOf(Date)
    expect(ws.getRow(4).getCell(3).value).toBe('Total')
    expect(ws.getRow(4).getCell(4).value).toBe(750.5)
    expect(wb.getWorksheet('Información')!.getRow(2).getCell(2).value).toBe('Admin Demo')
  })
})

describe('crearPdfPagos', () => {
  it('incluye título, filtros, filas y el total al final', () => {
    const pdf = new TextDecoder('latin1').decode(crearPdfPagos(filas, meta))
    expect(pdf.startsWith('%PDF')).toBe(true)
    for (const t of ['Pagos por usuario', 'Fracc Demo', 'abc-1', 'Total', '$750.50']) expect(pdf).toContain(t)
  })

  it('con logo dibuja la imagen arriba a la izquierda', () => {
    const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, 'addImage')
    crearPdfPagos(filas, meta, PNG)
    expect(spy).toHaveBeenCalledWith(PNG, 'PNG', 40, 22, 116, 24)
    spy.mockRestore()
  })
})
