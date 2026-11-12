import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { guardarTipoCuota } from '../actions'
import { AVISO_IMPORTE } from '../messages'
import { TipoCuotaDialog } from './tipo-cuota-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ guardarCatalogo: vi.fn(), guardarTipoCuota: vi.fn() }))

const PERFILES_NULOS = {
  perfilCorrienteId: null,
  perfilCorrienteNombre: null,
  perfilMorosoId: null,
  perfilMorosoNombre: null,
}
const item = { id: 1, nombre: 'Acceso Completo', importe: 250, medios: ['tarjeta' as const, 'telefono' as const], ...PERFILES_NULOS }

const TODOS = ['tarjeta', 'control', 'pin', 'telefono'] as const
const P1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const P2 = 'aaaaaaaa-0000-4000-8000-000000000002'
const PERFILES = [
  { id: P1, nombre: 'Residentes' },
  { id: P2, nombre: 'Morosos' },
]

async function abrir(props: Partial<Parameters<typeof TipoCuotaDialog>[0]> = {}) {
  const user = userEvent.setup()
  render(
    <TipoCuotaDialog
      trigger={<Button>Abrir</Button>}
      mediosHabilitados={[...TODOS]}
      perfiles={PERFILES}
      tieneInstalacion
      {...props}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

describe('TipoCuotaDialog', () => {
  beforeEach(() => vi.mocked(guardarTipoCuota).mockReset().mockResolvedValue({ ok: true, data: undefined }))

  it('al crear muestra una casilla por medio habilitado, sin marcar', async () => {
    await abrir()
    expect(screen.getByRole('dialog', { name: 'Agregar tipo de cuota' })).toBeInTheDocument()
    for (const name of ['Tarjeta', 'Control RF', 'PIN', 'Teléfono']) {
      expect(screen.getByRole('checkbox', { name })).not.toBeChecked()
    }
    expect(screen.queryByRole('checkbox', { name: 'Código QR' })).not.toBeInTheDocument()
  })

  it('al editar marca los medios del tipo de cuota', async () => {
    await abrir({ item })
    expect(screen.getByRole('checkbox', { name: 'Tarjeta' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Teléfono' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Control RF' })).not.toBeChecked()
  })

  it('al cambiar el importe avisa y guarda con los medios en el orden del catálogo', async () => {
    const user = await abrir({ item })
    expect(screen.queryByText(AVISO_IMPORTE)).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText(/Importe mensual/))
    await user.type(screen.getByLabelText(/Importe mensual/), '300')
    expect(screen.getByText(AVISO_IMPORTE)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Tarjeta' }))
    await user.click(screen.getByRole('checkbox', { name: 'PIN' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardarTipoCuota).toHaveBeenCalledWith(1, {
      nombre: 'Acceso Completo',
      importe: 300,
      medios: ['pin', 'telefono'],
      ...PERFILES_NULOS,
    })
  })

  it('con la prop guardar usa esa acción en lugar de la de Configuración', async () => {
    const guardar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const user = await abrir({ item, guardar })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).toHaveBeenCalledWith(1, {
      nombre: 'Acceso Completo',
      importe: 250,
      medios: ['tarjeta', 'telefono'],
      ...PERFILES_NULOS,
    })
    expect(guardarTipoCuota).not.toHaveBeenCalled()
  })

  it('solo muestra las casillas de los medios habilitados y guarda la intersección', async () => {
    const user = await abrir({ item, mediosHabilitados: ['tarjeta', 'pin'] })
    expect(screen.getAllByRole('checkbox').map((c) => c.id)).toEqual(['medio-tarjeta', 'medio-pin'])
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardarTipoCuota).toHaveBeenCalledWith(1, expect.objectContaining({ medios: ['tarjeta'] }))
  })

  it('sin medios habilitados avisa al super admin', async () => {
    await abrir({ mediosHabilitados: [] })
    expect(
      screen.getByText('El super admin aún no habilita medios de acceso para este fraccionamiento'),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('guarda el id y el nombre de los permisos elegidos', async () => {
    const user = await abrir({ item })
    await user.click(screen.getByRole('combobox', { name: 'Permiso al corriente' }))
    await user.click(screen.getByRole('option', { name: 'Residentes' }))
    await user.click(screen.getByRole('combobox', { name: 'Permiso moroso' }))
    await user.click(screen.getByRole('option', { name: 'Morosos' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardarTipoCuota).toHaveBeenCalledWith(1, {
      nombre: 'Acceso Completo',
      importe: 250,
      medios: ['tarjeta', 'telefono'],
      perfilCorrienteId: P1,
      perfilCorrienteNombre: 'Residentes',
      perfilMorosoId: P2,
      perfilMorosoNombre: 'Morosos',
    })
  })

  it('"Sin permiso" quita el permiso elegido', async () => {
    const user = await abrir({
      item: { ...item, perfilCorrienteId: P1, perfilCorrienteNombre: 'Residentes' },
    })
    expect(screen.getByRole('combobox', { name: 'Permiso al corriente' })).toHaveTextContent('Residentes')
    await user.click(screen.getByRole('combobox', { name: 'Permiso al corriente' }))
    await user.click(screen.getByRole('option', { name: 'Sin permiso' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardarTipoCuota).toHaveBeenCalledWith(1, expect.objectContaining(PERFILES_NULOS))
  })

  it('con perfiles null deshabilita los permisos y avisa', async () => {
    await abrir({ perfiles: null })
    expect(screen.getByRole('combobox', { name: 'Permiso al corriente' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Permiso moroso' })).toBeDisabled()
    expect(screen.getByText('No se pudo consultar access-core')).toBeInTheDocument()
  })

  it('sin instalación deshabilita los permisos y pide vincularla', async () => {
    await abrir({ perfiles: null, tieneInstalacion: false })
    expect(screen.getByRole('combobox', { name: 'Permiso moroso' })).toBeDisabled()
    expect(screen.getByText('Pide al super admin vincular la instalación de access-core')).toBeInTheDocument()
    expect(screen.queryByText('No se pudo consultar access-core')).not.toBeInTheDocument()
  })
})
