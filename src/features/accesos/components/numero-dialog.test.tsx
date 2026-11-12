import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { NumeroDialog } from './numero-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({
  crearTelefono: vi.fn(),
  actualizarTelefono: vi.fn(),
}))

async function abrir(props: Partial<Parameters<typeof NumeroDialog>[0]> = {}) {
  const user = userEvent.setup()
  render(<NumeroDialog domicilioId={7} trigger={<Button>Abrir</Button>} {...props} />)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

describe('NumeroDialog · teléfono', () => {
  it('no muestra Facility ni Card ID', async () => {
    await abrir()
    expect(screen.queryByRole('textbox', { name: 'Facility' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Card ID' })).not.toBeInTheDocument()
  })
})

describe('NumeroDialog · acciones personalizadas', () => {
  it('al guardar llama a la acción recibida en lugar de la del fraccionamiento', async () => {
    const acciones = {
      crearTelefono: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      actualizarTelefono: vi.fn(),
    }
    const user = await abrir({ acciones })
    await user.type(screen.getByLabelText(/Número de teléfono/), '5512345678')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(acciones.crearTelefono).toHaveBeenCalledWith(7, '5512345678')
    const { crearTelefono } = await import('../actions')
    expect(crearTelefono).not.toHaveBeenCalled()
  })
})
