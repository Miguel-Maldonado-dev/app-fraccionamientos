import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { MediosFraccionamiento } from './medios-fraccionamiento'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const guardar = vi.fn()

beforeEach(() => {
  guardar.mockReset().mockResolvedValue({ ok: true, data: undefined })
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('MediosFraccionamiento', () => {
  it('muestra una casilla por medio, marca los habilitados y deshabilita QR con "Próximamente"', () => {
    render(<MediosFraccionamiento habilitados={['tarjeta']} guardar={guardar} />)
    expect(screen.getByRole('checkbox', { name: 'Tarjeta' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Control RF' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Código QR/ })).toBeDisabled()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
  })

  it('guarda los medios marcados', async () => {
    const user = userEvent.setup()
    render(<MediosFraccionamiento habilitados={['tarjeta']} guardar={guardar} />)
    await user.click(screen.getByRole('checkbox', { name: 'PIN' }))
    await user.click(screen.getByRole('button', { name: 'Guardar medios' }))
    expect(guardar).toHaveBeenCalledWith(['tarjeta', 'pin'])
    expect(toast.success).toHaveBeenCalledWith('Medios guardados')
  })

  it('muestra el error de la acción', async () => {
    guardar.mockResolvedValue({ ok: false, error: 'Hay tipos de cuota que usan este medio' })
    const user = userEvent.setup()
    render(<MediosFraccionamiento habilitados={['tarjeta']} guardar={guardar} />)
    await user.click(screen.getByRole('checkbox', { name: 'Tarjeta' }))
    await user.click(screen.getByRole('button', { name: 'Guardar medios' }))
    expect(toast.error).toHaveBeenCalledWith('Hay tipos de cuota que usan este medio')
  })

  it('el botón guardar está deshabilitado sin cambios', () => {
    render(<MediosFraccionamiento habilitados={[]} guardar={guardar} />)
    expect(screen.getByRole('button', { name: 'Guardar medios' })).toBeDisabled()
  })
})
