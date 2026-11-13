import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Filtros } from '../filtros'
import { ExportarRegistros } from './exportar-registros'

const { paginaExport, generarExcel, generarPdf, descargar, cargarLogo } = vi.hoisted(() => ({
  cargarLogo: vi.fn().mockResolvedValue('data:image/png;base64,AAA'),
  paginaExport: vi.fn(),
  generarExcel: vi.fn(),
  generarPdf: vi.fn(),
  descargar: vi.fn(),
}))
vi.mock('../actions', () => ({ paginaExport }))
vi.mock('../export/generar', async (orig) => ({
  ...(await orig<object>()),
  generarExcel,
  generarPdf,
  cargarLogo,
}))
vi.mock('@/lib/download', () => ({ descargar }))

const F: Filtros = { desde: '2026-11-01', hasta: '2026-11-13', resultado: 'denegado', pagina: 2 }
const META = { fraccionamiento: 'Lago Amadeo', generadoPor: 'Ana', generadoEn: '13/11/2026' }
const fila = (id: number) => ({ id }) as never

function respuestas(total: number, paginas: number) {
  paginaExport.mockImplementation(async (_f: unknown, _filtros: unknown, p: number) => ({
    ok: true, filas: [fila(p)], total, pagina: p, paginas, ...(p === 1 ? { meta: META } : {}),
  }))
}

async function exportar(total: number, opcion: RegExp = /Excel/) {
  render(<ExportarRegistros fraccionamientoId={7} filtros={F} total={total} descripcionFiltros={['Resultado: Denegado']} />)
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  await userEvent.click(screen.getByRole('menuitem', { name: opcion }))
}

beforeEach(() => {
  vi.clearAllMocks()
  generarExcel.mockResolvedValue(new Blob(['x']))
  generarPdf.mockResolvedValue(new Blob(['x']))
})

describe('ExportarRegistros', () => {
  it('total 0 ⇒ avisa y no descarga', async () => {
    await exportar(0)
    expect(await screen.findByText('No hay registros para exportar')).toBeInTheDocument()
    expect(paginaExport).not.toHaveBeenCalled()
    expect(descargar).not.toHaveBeenCalled()
  })

  it('pide las páginas 1..n en orden y descarga Excel', async () => {
    respuestas(120, 3)
    await exportar(120)
    await waitFor(() => expect(descargar).toHaveBeenCalled(), { timeout: 5000 })
    expect(paginaExport.mock.calls.map((c) => [c[0], c[2]])).toEqual([[7, 1], [7, 2], [7, 3]])
    expect(paginaExport.mock.calls[0][1]).toEqual(F)
    const [filas, meta] = generarExcel.mock.lastCall!
    expect(filas).toHaveLength(3)
    expect(meta).toMatchObject({ fraccionamiento: 'Lago Amadeo', generadoPor: 'Ana', total: 120, exportados: 3, filtros: ['Resultado: Denegado'] })
    expect(descargar.mock.lastCall![1]).toBe('registros-acceso-lago-amadeo-2026-11-01_2026-11-13.xlsx')
  })

  it('muestra el progreso y deshabilita el botón', async () => {
    let liberar!: () => void
    respuestas(120, 3)
    const base = paginaExport.getMockImplementation()!
    paginaExport.mockImplementation(async (...a: unknown[]) => {
      if (a[2] === 2) await new Promise<void>((r) => (liberar = r))
      return base(...(a as [unknown, unknown, number]))
    })
    await exportar(120, /PDF/)
    expect(await screen.findByText('Exportando… 2 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportando/ })).toBeDisabled()
    liberar()
    await waitFor(() => expect(descargar).toHaveBeenCalled(), { timeout: 5000 })
    expect(descargar.mock.lastCall![1]).toMatch(/\.pdf$/)
    expect(generarPdf.mock.lastCall![1]).toMatchObject({ logo: 'data:image/png;base64,AAA' })
  })

  it('más de 5,000 ⇒ confirma y pide como máximo 100 páginas', async () => {
    respuestas(6000, 120)
    await exportar(6000)
    expect(
      await screen.findByText('Se exportarán los primeros 5,000 de 6,000 registros; reduce el rango para obtener todos'),
    ).toBeInTheDocument()
    expect(paginaExport).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    await waitFor(() => expect(descargar).toHaveBeenCalled(), { timeout: 5000 })
    expect(paginaExport).toHaveBeenCalledTimes(100)
    expect(generarExcel.mock.lastCall![1]).toMatchObject({ total: 6000, exportados: 100 })
  })

  it('falla una página ⇒ mensaje y sin descarga', async () => {
    paginaExport.mockResolvedValue({ ok: false, error: 'Demasiadas consultas, espera un momento' })
    await exportar(120)
    expect(await screen.findByText('No se pudo completar la exportación, intenta de nuevo')).toBeInTheDocument()
    expect(descargar).not.toHaveBeenCalled()
  })
  it('recalcula páginas con el total de la página 1 y quita duplicados', async () => {
    paginaExport.mockImplementation(async (_f: unknown, _filtros: unknown, p: number) => ({
      ok: true, filas: p === 2 ? [fila(1), fila(2)] : [fila(p)], total: 5200, pagina: p, paginas: 104,
      ...(p === 1 ? { meta: META } : {}),
    }))
    await exportar(120)
    await waitFor(() => expect(descargar).toHaveBeenCalled(), { timeout: 5000 })
    expect(paginaExport).toHaveBeenCalledTimes(100)
    const [filas, meta] = generarExcel.mock.lastCall!
    expect(new Set(filas.map((f: { id: number }) => f.id)).size).toBe(filas.length)
    expect(filas).toHaveLength(100)
    expect(meta).toMatchObject({ total: 5200, exportados: 100 })
  })
})
