// @vitest-environment node
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { describe, expect, it, vi } from 'vitest'
import type { FilaRegistro } from '../traduccion'
import { ENCABEZADOS, generarExcel, generarPdf, nombreArchivo } from './generar'

const fila = (id: number, permitido: boolean): FilaRegistro => ({
  id, fechaHora: '13/11/2026 10:00:00', panel: 'P1', titular: 'Calle 1', origen: 'Tarjeta', credencial: '—',
  salida: 'Salida 1', permitido, resultado: permitido ? 'Permitido' : 'Denegado', motivo: permitido ? 'Permitido' : 'Sin permiso',
})
const filas = [fila(1, true), fila(2, false)]
const meta = {
  fraccionamiento: 'Lago Amadeo', desde: '2026-11-01', hasta: '2026-11-13', filtros: ['Resultado: Denegado'],
  generadoPor: 'Ana', generadoEn: '13/11/2026, 10:00:00', total: 2, exportados: 2,
}

describe('generarExcel', () => {
  it('hojas Registros (8 columnas) e Información', async () => {
    const blob = await generarExcel(filas, meta)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    const ws = wb.getWorksheet('Registros')!
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(ENCABEZADOS)
    expect(ENCABEZADOS).toHaveLength(8)
    expect(ws.getRow(3).getCell(7).value).toBe('Denegado')
    const fecha = ws.getRow(2).getCell(1)
    expect(fecha.value).toBeInstanceOf(Date)
    expect((fecha.value as Date).toISOString()).toBe('2026-11-13T10:00:00.000Z')
    expect(fecha.numFmt).toBe('dd/mm/yyyy hh:mm:ss')
    const info = wb.getWorksheet('Información')!
    const textos = info.getSheetValues().flat().filter(Boolean)
    expect(textos).toContain('Lago Amadeo')
    expect(textos).toContain('01/11/2026 al 13/11/2026')
  })
})

describe('generarPdf', () => {
  it('carta horizontal con título, periodo, generado por y paginación', async () => {
    const blob = await generarPdf(filas, meta)
    expect(blob.type).toBe('application/pdf')
    const txt = Buffer.from(await blob.arrayBuffer()).toString('latin1')
    expect(txt).toContain('/MediaBox [0 0 792. 612.]')
    expect(txt).toMatch(/\(Registros de acceso\) Tj/)
    expect(txt).toMatch(/\(Lago Amadeo\) Tj/)
    expect(txt).toContain('01/11/2026 al 13/11/2026')
    expect(txt).toContain('Generado por Ana')
    expect(txt).toContain('Página 1 de 1')
  })
})

// PNG 1×1 válido.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

describe('generarPdf con logo', () => {
  it('logo ⇒ addImage arriba a la izquierda', async () => {
    const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, 'addImage')
    await generarPdf(filas, { ...meta, logo: PNG })
    expect(spy).toHaveBeenCalledWith(PNG, 'PNG', 36, 22, 116, 24)
    spy.mockRestore()
  })
  it('logo null ⇒ genera sin imagen', async () => {
    const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, 'addImage')
    const blob = await generarPdf(filas, { ...meta, logo: null })
    expect(spy).not.toHaveBeenCalled()
    expect(blob.size).toBeGreaterThan(0)
    spy.mockRestore()
  })
})

describe('nombreArchivo', () => {
  it('slug y rango', () => {
    expect(nombreArchivo({ fraccionamiento: 'Lago Amadeo Ñ', desde: '2026-11-01', hasta: '2026-11-13' }, 'pdf')).toBe(
      'registros-acceso-lago-amadeo-n-2026-11-01_2026-11-13.pdf',
    )
  })
})
