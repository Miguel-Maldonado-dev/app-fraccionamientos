import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { fijarPinDomicilio, generarPinDomicilio, quitarPinDomicilio } from '../actions'
import { PinCard } from './pin-card'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../actions', () => ({
  fijarPinDomicilio: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  generarPinDomicilio: vi.fn().mockResolvedValue({ ok: true, data: { pin: '482913' } }),
  quitarPinDomicilio: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

beforeEach(() => vi.clearAllMocks())

describe('PinCard', () => {
  it('con pin: undefined (comité/vigilancia) no muestra dígitos ni acciones', () => {
    render(<PinCard domicilioId={9} pin={undefined} sincronizado />)
    expect(screen.getByText('PIN gestionado por la administración')).toBeInTheDocument()
    expect(screen.queryByText(/\d{4,6}/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fijar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar' })).not.toBeInTheDocument()
  })

  it('con PIN lo muestra junto a "Asignado"', () => {
    render(<PinCard domicilioId={9} pin="1234" sincronizado />)
    expect(screen.getByText('1234')).toBeInTheDocument()
    expect(screen.getByText('Asignado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeEnabled()
  })

  it('sin PIN muestra "Sin PIN" y no ofrece quitar', () => {
    render(<PinCard domicilioId={9} pin={null} sincronizado />)
    expect(screen.getByText('Sin PIN')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument()
  })

  it('sin sincronizar deshabilita las acciones con el aviso', () => {
    render(<PinCard domicilioId={9} pin={null} sincronizado={false} />)
    expect(screen.getByText('El domicilio aún no está sincronizado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fijar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Generar' })).toBeDisabled()
  })

  it('fijar valida de 4 a 6 dígitos y llama a la acción', async () => {
    const user = userEvent.setup()
    render(<PinCard domicilioId={9} pin={null} sincronizado />)
    await user.click(screen.getByRole('button', { name: 'Fijar' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/PIN/), '12')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText('El PIN debe tener de 4 a 6 dígitos')).toBeInTheDocument()
    expect(fijarPinDomicilio).not.toHaveBeenCalled()
    await user.type(within(dialog).getByLabelText(/PIN/), '345')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(fijarPinDomicilio).toHaveBeenCalledWith(9, '12345')
  })

  it('fijar muestra el error de la API', async () => {
    vi.mocked(fijarPinDomicilio).mockResolvedValueOnce({ ok: false, error: 'El PIN ya está en uso' })
    const user = userEvent.setup()
    render(<PinCard domicilioId={9} pin={null} sincronizado />)
    await user.click(screen.getByRole('button', { name: 'Fijar' }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/PIN/), '1234')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
    expect(toast.error).toHaveBeenCalledWith('El PIN ya está en uso')
  })

  it('generar muestra el PIN generado para entregarlo', async () => {
    const user = userEvent.setup()
    render(<PinCard domicilioId={9} pin={null} sincronizado />)
    await user.click(screen.getByRole('button', { name: 'Generar' }))
    expect(generarPinDomicilio).toHaveBeenCalledWith(9)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('482913')).toBeInTheDocument()
  })

  it('generar con un PIN existente pide confirmación antes de reemplazarlo', async () => {
    const user = userEvent.setup()
    render(<PinCard domicilioId={9} pin="1234" sincronizado />)
    await user.click(screen.getByRole('button', { name: 'Generar' }))
    expect(generarPinDomicilio).not.toHaveBeenCalled()
    const confirmar = screen.getByRole('alertdialog')
    expect(within(confirmar).getByText('Se reemplazará el PIN actual del domicilio.')).toBeInTheDocument()
    await user.click(within(confirmar).getByRole('button', { name: 'Generar' }))
    expect(generarPinDomicilio).toHaveBeenCalledWith(9)
    expect(await screen.findByText('482913')).toBeInTheDocument()
  })

  it('quitar pide confirmación', async () => {
    const user = userEvent.setup()
    render(<PinCard domicilioId={9} pin="1234" sincronizado />)
    await user.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(quitarPinDomicilio).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar' }))
    expect(quitarPinDomicilio).toHaveBeenCalledWith(9)
  })

  it('usa las acciones que recibe (consola)', async () => {
    const generar = vi.fn().mockResolvedValue({ ok: true, data: { pin: '9999' } })
    const user = userEvent.setup()
    render(
      <PinCard
        domicilioId={9}
        pin={null}
        sincronizado
        acciones={{ fijarPin: vi.fn(), generarPin: generar, quitarPin: vi.fn() }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Generar' }))
    expect(generar).toHaveBeenCalledWith(9)
    expect(generarPinDomicilio).not.toHaveBeenCalled()
  })
})
