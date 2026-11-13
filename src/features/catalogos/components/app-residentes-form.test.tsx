import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppResidentesForm } from './app-residentes-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('AppResidentesForm', () => {
  it.each(['0', '21', '2.5', ''])('rechaza %j sin llamar a la acción', async (valor) => {
    const guardar = vi.fn()
    render(<AppResidentesForm maximo={5} guardar={guardar} />)
    const input = screen.getByLabelText('Residentes con acceso a la app por domicilio')
    await userEvent.clear(input)
    if (valor) await userEvent.type(input, valor)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('Debe ser un número entre 1 y 20')).toBeInTheDocument()
    expect(guardar).not.toHaveBeenCalled()
  })

  it('guarda un valor válido', async () => {
    const guardar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    render(<AppResidentesForm maximo={5} guardar={guardar} />)
    const input = screen.getByLabelText('Residentes con acceso a la app por domicilio')
    await userEvent.clear(input)
    await userEvent.type(input, '8')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).toHaveBeenCalledWith(8)
  })
})
