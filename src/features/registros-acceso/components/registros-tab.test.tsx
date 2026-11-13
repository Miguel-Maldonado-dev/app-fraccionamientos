import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const consultarRegistros = vi.hoisted(() => vi.fn())
const opcionesRegistros = vi.hoisted(() => vi.fn())
const refresh = vi.hoisted(() => vi.fn())
vi.mock('../actions', () => ({
  consultarRegistros: (...a: unknown[]) => consultarRegistros(...a),
  opcionesRegistros: (...a: unknown[]) => opcionesRegistros(...a),
}))
vi.mock('@/lib/dates', () => ({ todayISO: () => '2026-11-13' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { RegistrosTab } from './registros-tab'

const fila = {
  id: 1, fechaHora: '13/11/2026 08:00:00', panel: 'P1', titular: 'Calle 1', origen: 'PIN', credencial: '1234',
  salida: 'Pluma', permitido: true, resultado: 'Permitido' as const, motivo: 'Permitido',
}

beforeEach(() => {
  vi.clearAllMocks()
  consultarRegistros.mockResolvedValue({ ok: true, filas: [fila], total: 120, pagina: 2, paginas: 3 })
  opcionesRegistros.mockResolvedValue({
    domicilios: [{ id: 7, direccion: 'Calle 1' }],
    paneles: [{ id: 'pan-1', panel_code: 'P1' }],
  })
})

const render2 = async (sp: Record<string, string>, extra: Partial<Parameters<typeof RegistrosTab>[0]> = {}) =>
  render(await RegistrosTab({ fraccionamientoId: 5, searchParams: sp, basePath: '/admin/fraccionamientos/5', fijos: { tab: 'accesos', vista: 'registros' }, ...extra }))

describe('RegistrosTab', () => {
  it('consulta con los filtros de la URL y arma enlaces que los conservan', async () => {
    await render2({ desde: '2026-11-01', hasta: '2026-11-13', resultado: 'denegado', pagina: '2', domicilio: '7' })
    expect(consultarRegistros).toHaveBeenCalledWith(5, {
      desde: '2026-11-01', hasta: '2026-11-13', resultado: 'denegado', pagina: 2, domicilio: 7,
    })
    const sig = screen.getByRole('link', { name: 'Página siguiente' }).getAttribute('href')!
    const q = new URL(sig, 'http://x').searchParams
    expect(Object.fromEntries(q)).toEqual({
      tab: 'accesos', vista: 'registros', desde: '2026-11-01', hasta: '2026-11-13', domicilio: '7', resultado: 'denegado', pagina: '3',
    })
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-01')
    // El valor del select viaja en un input oculto con el nombre del filtro.
    expect(document.querySelector('input[type="hidden"][name="domicilio"]')).toHaveValue('7')
    expect(document.querySelector('input[type="hidden"][name="panel"]')).toHaveValue('')
    expect(screen.getByLabelText('Domicilio')).toHaveTextContent('Calle')
    expect(screen.getByRole('link', { name: /Limpiar/ })).toHaveAttribute('href', '/admin/fraccionamientos/5?tab=accesos&vista=registros')
  })

  it('sin aplicar filtros no consulta access-core y pide aplicarlos (fechas por omisión hoy–hoy)', async () => {
    await render2({})
    expect(consultarRegistros).not.toHaveBeenCalled()
    expect(screen.getByText(/Configura los filtros y presiona/)).toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-13')
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-11-13')
  })

  it('al aplicar consulta con los filtros', async () => {
    await render2({ desde: '2026-11-13', hasta: '2026-11-13' })
    expect(consultarRegistros).toHaveBeenCalledWith(5, { desde: '2026-11-13', hasta: '2026-11-13', pagina: 1 })
  })

  it('muestra el error de validación del rango y no consulta', async () => {
    await render2({ desde: '2026-01-01', hasta: '2026-11-13' })
    expect(screen.getByRole('alert')).toHaveTextContent('El rango máximo es de 31 días')
    expect(consultarRegistros).not.toHaveBeenCalled()
  })

  it('error de consulta con Reintentar', async () => {
    consultarRegistros.mockResolvedValue({ ok: false, error: 'Demasiadas consultas, espera un momento' })
    await render2({ desde: '2026-11-13', hasta: '2026-11-13' })
    expect(screen.getByText('Demasiadas consultas, espera un momento')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(refresh).toHaveBeenCalled()
  })

  it('renderiza el hueco de exportar', async () => {
    await render2({}, { exportar: <button type="button">Exportar</button> })
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
  })
})
