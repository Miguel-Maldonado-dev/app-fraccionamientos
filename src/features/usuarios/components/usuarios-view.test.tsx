import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Views } from '@/lib/supabase/types'
import { cambiarEstadoUsuario } from '../actions'
import { UsuariosView } from './usuarios-view'

vi.mock('../actions', () => ({
  cambiarEstadoUsuario: vi.fn(),
  crearUsuario: vi.fn(),
  editarUsuario: vi.fn(),
}))

const replace = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/usuarios',
  useSearchParams: () => new URLSearchParams(search),
}))

const row = (id: string, user_name: string, email: string, rol: string) =>
  ({ id, user_name, email, rol, is_active: true }) as Views<'users_info'>

const rows = [row('u1', 'Obed Ramos', 'obed@x.com', 'tesorero'), row('u2', 'Ana Pérez', 'ana@x.com', 'comite')]

describe('UsuariosView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    replace.mockClear()
    search = ''
  })
  afterEach(() => vi.useRealTimers())

  test('buscar filtra filas', () => {
    render(<UsuariosView rows={rows} currentUserId="u2" estado="activos" />)
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o email...'), {
      target: { value: 'obed' },
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument()
  })

  test('badges de rol y estatus', () => {
    render(<UsuariosView rows={rows} currentUserId="u2" estado="activos" />)
    expect(screen.getByText('Tesorero').className).toContain('bg-info-light')
    expect(screen.getByText('Comité')).toBeInTheDocument()
    expect(screen.getAllByText('Activo')[0].className).toContain('bg-success-light')
  })

  test('el usuario actual no puede desactivarse', () => {
    render(<UsuariosView rows={rows} currentUserId="u2" estado="activos" />)
    const fila = screen.getByText('Ana Pérez').closest('tr')!
    expect(within(fila).queryByRole('button', { name: 'Desactivar usuario' })).not.toBeInTheDocument()
    const otra = screen.getByText('Obed Ramos').closest('tr')!
    expect(within(otra).getByRole('button', { name: 'Desactivar usuario' })).toBeInTheDocument()
  })

  test('por defecto muestra el botón de editar', () => {
    render(<UsuariosView rows={rows} currentUserId="u2" estado="activos" />)
    expect(screen.getAllByRole('button', { name: 'Editar usuario' })).toHaveLength(2)
  })

  test('con permitirEditar=false no hay botón de editar', () => {
    render(<UsuariosView rows={rows} currentUserId="" estado="activos" permitirEditar={false} />)
    expect(screen.queryAllByRole('button', { name: /^Editar/ })).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: 'Desactivar usuario' })).toHaveLength(2)
  })

  test('con la prop cambiarEstado activa con esa función y no con cambiarEstadoUsuario', async () => {
    vi.useRealTimers()
    const cambiarEstado = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const inactiva = { ...rows[0], is_active: false }
    render(<UsuariosView rows={[inactiva]} currentUserId="" estado="inactivos" cambiarEstado={cambiarEstado} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Activar usuario' }))
    })
    expect(cambiarEstado).toHaveBeenCalledWith('u1', true)
    expect(cambiarEstadoUsuario).not.toHaveBeenCalled()
  })

  test('cambiar el estado conserva los demás parámetros (tab)', async () => {
    vi.useRealTimers()
    search = 'tab=usuarios'
    render(<UsuariosView rows={rows} currentUserId="" estado="activos" />)
    await userEvent.click(screen.getByLabelText('Estado'))
    await userEvent.click(screen.getByRole('option', { name: 'Inactivos' }))
    const url = replace.mock.calls[0][0] as string
    expect(url).toContain('tab=usuarios')
    expect(url).toContain('estado=inactivos')
  })

  test('limpiar quita estado pero conserva tab', () => {
    vi.useRealTimers()
    search = 'tab=usuarios&estado=inactivos'
    render(<UsuariosView rows={rows} currentUserId="" estado="inactivos" />)
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }))
    expect(replace).toHaveBeenCalledWith('/usuarios?tab=usuarios')
  })
})
