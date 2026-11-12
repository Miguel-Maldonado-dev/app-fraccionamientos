import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { actualizarFraccionamiento, crearFraccionamiento } from '../actions'
import { FraccionamientoDialog } from './fraccionamiento-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../actions', () => ({ crearFraccionamiento: vi.fn(), actualizarFraccionamiento: vi.fn() }))

const item = { id: 5, nombre: 'Los Pinos', slug: 'los-pinos', activo: false, instalacionId: null, instalacionNombre: null, usuarios: 0, domicilios: 0 }

async function abrir(props: Partial<Parameters<typeof FraccionamientoDialog>[0]> = {}) {
  const user = userEvent.setup()
  render(<FraccionamientoDialog instalaciones={[]} trigger={<Button>Abrir</Button>} {...props} />)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

describe('FraccionamientoDialog', () => {
  beforeEach(() => {
    vi.mocked(crearFraccionamiento).mockReset().mockResolvedValue({ ok: true, data: { id: 9 } })
    vi.mocked(actualizarFraccionamiento).mockReset().mockResolvedValue({ ok: true, data: undefined })
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('rellena el slug desde el nombre', async () => {
    const user = await abrir()
    await user.type(screen.getByLabelText(/Nombre/), 'Lomas del Río')
    expect(screen.getByLabelText(/Slug/)).toHaveValue('lomas-del-rio')
  })

  it('tras editar el slug a mano, el nombre ya no lo sobrescribe', async () => {
    const user = await abrir()
    await user.type(screen.getByLabelText(/Nombre/), 'Lomas')
    await user.clear(screen.getByLabelText(/Slug/))
    await user.type(screen.getByLabelText(/Slug/), 'mi-slug')
    await user.type(screen.getByLabelText(/Nombre/), ' del Río')
    expect(screen.getByLabelText(/Slug/)).toHaveValue('mi-slug')
  })

  it('crea con activo encendido por defecto', async () => {
    const user = await abrir()
    await user.type(screen.getByLabelText(/Nombre/), 'Lomas del Río')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(crearFraccionamiento).toHaveBeenCalledWith({
      nombre: 'Lomas del Río',
      slug: 'lomas-del-rio',
      instalacionId: '',
      instalacionNombre: null,
      activo: true,
    })
    expect(toast.success).toHaveBeenCalled()
  })

  it('con item actualiza y no reescribe el slug', async () => {
    const user = await abrir({ item })
    await user.type(screen.getByLabelText(/Nombre/), ' Norte')
    expect(screen.getByLabelText(/Slug/)).toHaveValue('los-pinos')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(actualizarFraccionamiento).toHaveBeenCalledWith(5, {
      nombre: 'Los Pinos Norte',
      slug: 'los-pinos',
      instalacionId: '',
      instalacionNombre: null,
      activo: false,
    })
  })

  it('muestra el error de la acción', async () => {
    vi.mocked(crearFraccionamiento).mockResolvedValue({ ok: false, error: 'Slug en uso' })
    const user = await abrir()
    await user.type(screen.getByLabelText(/Nombre/), 'Lomas')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(toast.error).toHaveBeenCalledWith('Slug en uso')
  })

  it('con instalaciones null avisa y deshabilita el campo, y conserva el valor actual', async () => {
    const user = await abrir({
      instalaciones: null,
      item: { ...item, instalacionId: 'a3f2504e-4f89-41d3-9a0c-0305e82c3301', instalacionNombre: 'Norte' },
    })
    expect(screen.getByText('No se pudo consultar access-core')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Instalación/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(actualizarFraccionamiento).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ instalacionId: 'a3f2504e-4f89-41d3-9a0c-0305e82c3301', instalacionNombre: 'Norte' }),
    )
  })

  it('elegir una instalación manda su id y su nombre', async () => {
    const user = await abrir({ instalaciones: [{ id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', nombre: 'Sur' }] })
    await user.type(screen.getByLabelText(/Nombre/), 'Lomas')
    await user.click(screen.getByRole('combobox', { name: /Instalación/ }))
    await user.click(screen.getByRole('option', { name: 'Sur' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(crearFraccionamiento).toHaveBeenCalledWith(
      expect.objectContaining({ instalacionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', instalacionNombre: 'Sur' }),
    )
  })

  it('al editar incluye la instalación actual entre las opciones y permite "Sin instalación"', async () => {
    const user = await abrir({
      instalaciones: [],
      item: { ...item, instalacionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', instalacionNombre: 'Sur' },
    })
    await user.click(screen.getByRole('combobox', { name: /Instalación/ }))
    expect(screen.getByRole('option', { name: 'Sur' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Sin instalación' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(actualizarFraccionamiento).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ instalacionId: '', instalacionNombre: null }),
    )
  })
})
