import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FraccionamientosTable } from './fraccionamientos-table'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }))
vi.mock('../actions', () => ({ crearFraccionamiento: vi.fn(), actualizarFraccionamiento: vi.fn() }))

const rows = [
  { id: 1, nombre: 'Lago Amadeo', slug: 'lago-amadeo', activo: true, instalacionId: null, instalacionNombre: null, usuarios: 3, domicilios: 120 },
  { id: 2, nombre: 'Los Pinos', slug: 'los-pinos', activo: false, instalacionId: null, instalacionNombre: null, usuarios: 1, domicilios: 8 },
]

describe('FraccionamientosTable', () => {
  it('muestra columnas, enlaces, estado y conteos', () => {
    render(<FraccionamientosTable rows={rows} instalaciones={[]} />)
    for (const h of ['Nombre', 'Slug', 'Estado', 'Usuarios', 'Domicilios', 'Acciones'])
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lago Amadeo' })).toHaveAttribute('href', '/admin/fraccionamientos/1')
    const fila = screen.getByRole('row', { name: /Lago Amadeo/ })
    expect(within(fila).getByText('lago-amadeo')).toBeInTheDocument()
    expect(within(fila).getByText('Activo')).toBeInTheDocument()
    expect(within(fila).getByText('120')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Los Pinos/ })).getByText('Inactivo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar Los Pinos' })).toBeInTheDocument()
  })

  it('al hacer clic en cualquier parte de la fila abre el detalle, pero no al editar', async () => {
    render(<FraccionamientosTable rows={rows} instalaciones={[]} />)
    await userEvent.click(screen.getByText('los-pinos'))
    expect(push).toHaveBeenCalledWith('/admin/fraccionamientos/2')
    push.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Editar Los Pinos' }))
    expect(push).not.toHaveBeenCalled()
  })

  it('sin filas muestra el estado vacío', () => {
    render(<FraccionamientosTable rows={[]} instalaciones={[]} />)
    expect(screen.getByText('Aún no hay fraccionamientos.')).toBeInTheDocument()
  })
})
