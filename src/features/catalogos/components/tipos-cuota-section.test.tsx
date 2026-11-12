import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { guardarTipoCuota } from '../actions'
import { TiposCuotaSection } from './tipos-cuota-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ guardarTipoCuota: vi.fn(), guardarCatalogo: vi.fn() }))

const PERFILES_NULOS = {
  perfilCorrienteId: null,
  perfilCorrienteNombre: null,
  perfilMorosoId: null,
  perfilMorosoNombre: null,
}
const rows = [
  { id: 1, nombre: 'Acceso Completo', importe: 250, medios: ['tarjeta' as const, 'telefono' as const], ...PERFILES_NULOS },
  { id: 2, nombre: 'Acceso Peatonal', importe: 100, medios: ['tarjeta' as const], ...PERFILES_NULOS },
  { id: 3, nombre: 'Sin accesos', importe: 80, medios: [], ...PERFILES_NULOS },
]

const props = { mediosHabilitados: ['tarjeta' as const], perfiles: null, tieneInstalacion: true }

describe('TiposCuotaSection', () => {
  it('muestra los nombres de los permisos o un guion', () => {
    const conPermisos = [
      { ...rows[0], perfilCorrienteId: 'p1', perfilCorrienteNombre: 'Residentes', perfilMorosoId: null, perfilMorosoNombre: null },
    ]
    render(<TiposCuotaSection rows={conPermisos} {...props} />)
    for (const name of ['Permiso al corriente', 'Permiso moroso']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    const celdas = within(screen.getByText('Acceso Completo').closest('tr')!).getAllByRole('cell')
    expect(celdas[3]).toHaveTextContent('Residentes')
    expect(celdas[4]).toHaveTextContent('—')
  })

  it('muestra las columnas del catálogo', () => {
    render(<TiposCuotaSection rows={rows} {...props} />)
    for (const name of ['Nombre', 'Importe mensual', 'Medios de acceso', 'Permiso al corriente', 'Permiso moroso', 'Acciones']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
  })

  it('muestra los medios de cada tipo de cuota como badges', () => {
    render(<TiposCuotaSection rows={rows} {...props} />)
    const [, , completo] = within(screen.getByText('Acceso Completo').closest('tr')!).getAllByRole('cell')
    expect(within(completo).getByText('Tarjeta')).toBeInTheDocument()
    expect(within(completo).getByText('Teléfono')).toBeInTheDocument()
    const [, , peatonal] = within(screen.getByText('Acceso Peatonal').closest('tr')!).getAllByRole('cell')
    expect(peatonal).toHaveTextContent('Tarjeta')
    expect(peatonal).not.toHaveTextContent('Teléfono')
    const [, , ninguno] = within(screen.getByText('Sin accesos').closest('tr')!).getAllByRole('cell')
    expect(ninguno).toHaveTextContent('—')
    expect(screen.getByRole('button', { name: 'Editar Acceso Peatonal' })).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('sin elementos muestra el estado vacío', () => {
    render(<TiposCuotaSection rows={[]} {...props} />)
    expect(screen.getByText('Sin elementos')).toBeInTheDocument()
  })

  it('pasa la prop guardar a los diálogos', async () => {
    const guardar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    render(<TiposCuotaSection rows={rows} guardar={guardar} {...props} />)
    await user.click(screen.getByRole('button', { name: 'Editar Acceso Peatonal' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).toHaveBeenCalledWith(2, { nombre: 'Acceso Peatonal', importe: 100, medios: ['tarjeta'], ...PERFILES_NULOS })
    expect(guardarTipoCuota).not.toHaveBeenCalled()
  })
})
