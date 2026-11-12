import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { BotonesFraccionamiento } from './botones-fraccionamiento'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const guardar = vi.fn()
const P1 = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const salidas = [
  { panelId: P1, panelCodigo: 'PNL-1', salida: 0 as const, alias: 'Portón' },
  { panelId: P1, panelCodigo: 'PNL-1', salida: 1 as const, alias: 'Puerta' },
]

beforeEach(() => {
  guardar.mockReset().mockResolvedValue({ ok: true, data: undefined })
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('BotonesFraccionamiento', () => {
  it('muestra cuatro filas con la salida configurada', () => {
    render(
      <BotonesFraccionamiento
        salidas={salidas}
        botones={[{ boton: 1, panelId: P1, panelCodigo: 'PNL-1', salida: 1, salidaAlias: 'Puerta' }]}
        guardar={guardar}
      />,
    )
    for (const n of [1, 2, 3, 4]) expect(screen.getByRole('combobox', { name: `Botón ${n}` })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Botón 2' })).toHaveTextContent('PNL-1 · Puerta')
    expect(screen.getByRole('combobox', { name: 'Botón 1' })).toHaveTextContent('Ninguna')
  })

  it('con salidas null deshabilita todo y avisa', () => {
    render(<BotonesFraccionamiento salidas={null} botones={[]} guardar={guardar} />)
    expect(screen.getByText('No se pudo consultar access-core')).toBeInTheDocument()
    for (const n of [1, 2, 3, 4]) expect(screen.getByRole('combobox', { name: `Botón ${n}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar botones' })).toBeDisabled()
  })

  it('guarda la salida elegida', async () => {
    const user = userEvent.setup()
    render(<BotonesFraccionamiento salidas={salidas} botones={[]} guardar={guardar} />)
    await user.click(screen.getByRole('combobox', { name: 'Botón 1' }))
    await user.click(screen.getByRole('option', { name: 'PNL-1 · Portón' }))
    await user.click(screen.getByRole('button', { name: 'Guardar botones' }))
    expect(guardar).toHaveBeenCalledWith([{ boton: 0, panelId: P1, panelCodigo: 'PNL-1', salida: 0, salidaAlias: 'Portón' }])
    expect(toast.success).toHaveBeenCalledWith('Botones guardados')
  })

  it('"Ninguna" quita la salida', async () => {
    const user = userEvent.setup()
    render(
      <BotonesFraccionamiento
        salidas={salidas}
        botones={[{ boton: 0, panelId: P1, panelCodigo: 'PNL-1', salida: 0, salidaAlias: 'Portón' }]}
        guardar={guardar}
      />,
    )
    await user.click(screen.getByRole('combobox', { name: 'Botón 1' }))
    await user.click(screen.getByRole('option', { name: 'Ninguna' }))
    await user.click(screen.getByRole('button', { name: 'Guardar botones' }))
    expect(guardar).toHaveBeenCalledWith([])
  })

  it('conserva una salida guardada que ya no existe en la instalación', () => {
    render(
      <BotonesFraccionamiento
        salidas={[]}
        botones={[{ boton: 0, panelId: P1, panelCodigo: 'PNL-9', salida: 3, salidaAlias: 'Vieja' }]}
        guardar={guardar}
      />,
    )
    expect(screen.getByRole('combobox', { name: 'Botón 1' })).toHaveTextContent('PNL-9 · Vieja')
  })

  it('muestra el error de la acción', async () => {
    guardar.mockResolvedValue({ ok: false, error: 'Falló' })
    const user = userEvent.setup()
    render(<BotonesFraccionamiento salidas={salidas} botones={[]} guardar={guardar} />)
    await user.click(screen.getByRole('combobox', { name: 'Botón 1' }))
    await user.click(screen.getByRole('option', { name: 'PNL-1 · Puerta' }))
    await user.click(screen.getByRole('button', { name: 'Guardar botones' }))
    expect(toast.error).toHaveBeenCalledWith('Falló')
  })
})
