import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { TarjetaDialog } from './tarjeta-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({
  crearTarjeta: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  actualizarTarjeta: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

const writeText = vi.fn().mockResolvedValue(undefined)

async function abrir(props: Partial<Parameters<typeof TarjetaDialog>[0]> = {}) {
  const user = userEvent.setup()
  // userEvent.setup() instala su propio portapapeles; el simulado va después.
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<TarjetaDialog domicilioId={7} trigger={<Button>Abrir</Button>} {...props} />)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

describe('TarjetaDialog · crear', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calcula Facility y Card ID mientras se escribe el código', async () => {
    const user = await abrir()
    await user.type(screen.getByLabelText(/Número de tarjeta/), '8518512')
    expect(screen.getByRole('textbox', { name: 'Facility' })).toHaveValue('129')
    expect(screen.getByRole('textbox', { name: 'Card ID' })).toHaveValue('64368')
  })

  it('los valores son de solo lectura y se copian con su botón', async () => {
    const user = await abrir()
    await user.type(screen.getByLabelText(/Número de tarjeta/), '8518512')
    expect(screen.getByRole('textbox', { name: 'Facility' })).toHaveAttribute('readonly')
    await user.click(screen.getByRole('button', { name: 'Copiar Facility' }))
    expect(writeText).toHaveBeenCalledWith('129')
    await user.click(screen.getByRole('button', { name: 'Copiar Card ID' }))
    expect(writeText).toHaveBeenCalledWith('64368')
  })

  it('sin código los valores quedan vacíos y no se pueden copiar', async () => {
    await abrir()
    expect(screen.getByRole('textbox', { name: 'Facility' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Copiar Facility' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copiar Card ID' })).toBeDisabled()
  })

  it('avisa cuando el código excede 32 bits', async () => {
    const user = await abrir()
    await user.type(screen.getByLabelText(/Número de tarjeta/), '4294967296')
    expect(screen.getByText('El código excede 32 bits')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Card ID' })).toHaveValue('')
  })

  it('guarda número y descripción', async () => {
    const user = await abrir()
    await user.type(screen.getByLabelText(/Número de tarjeta/), '8518512')
    await user.type(screen.getByLabelText('Descripción'), 'Auto rojo')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const { crearTarjeta } = await import('../actions')
    expect(crearTarjeta).toHaveBeenCalledWith(7, { numero: '8518512', descripcion: 'Auto rojo' })
  })

  it('usa las acciones recibidas en lugar de las del fraccionamiento', async () => {
    const acciones = {
      crearTarjeta: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      actualizarTarjeta: vi.fn(),
    }
    const user = await abrir({ acciones })
    await user.type(screen.getByLabelText(/Número de tarjeta/), '123')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(acciones.crearTarjeta).toHaveBeenCalledWith(7, { numero: '123', descripcion: '' })
    const { crearTarjeta } = await import('../actions')
    expect(crearTarjeta).not.toHaveBeenCalled()
  })
})

describe('TarjetaDialog · editar', () => {
  beforeEach(() => vi.clearAllMocks())
  const item = { id: 1, numero: '0008517721', descripcion: 'Auto' }

  it('el número no se puede editar: solo se muestra, con su desglose', async () => {
    await abrir({ item })
    expect(screen.queryByRole('textbox', { name: /Número de tarjeta/ })).not.toBeInTheDocument()
    expect(screen.getByText('0008517721')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Facility' })).toHaveValue('129')
    expect(screen.getByRole('textbox', { name: 'Card ID' })).toHaveValue('63577')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Auto')
  })

  it('guarda solo la descripción', async () => {
    const user = await abrir({ item })
    const descripcion = screen.getByLabelText('Descripción')
    await user.clear(descripcion)
    await user.type(descripcion, 'Moto')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const { actualizarTarjeta } = await import('../actions')
    expect(actualizarTarjeta).toHaveBeenCalledWith(1, 7, 'Moto')
  })
})
