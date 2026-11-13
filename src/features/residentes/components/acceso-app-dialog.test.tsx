import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tables } from '@/lib/supabase/types'
import { AccesoAppDialog } from './acceso-app-dialog'

const { refresh, darAccesoApp, restablecer, success } = vi.hoisted(() => ({
  refresh: vi.fn(),
  darAccesoApp: vi.fn(),
  restablecer: vi.fn(),
  success: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('sonner', () => ({ toast: { success, error: vi.fn() } }))
vi.mock('../cuentas-actions', () => ({
  darAccesoApp,
  restablecerPasswordResidente: restablecer,
}))

const residente: Tables<'residentes'> = {
  id: 3,
  domicilio_id: 7,
  fraccionamiento_id: 1,
  nombre: 'Ana López',
  telefono: '3312345678',
  es_principal: false,
  created_at: '2026-01-01T00:00:00Z',
  user_id: null,
}

async function abrir(modo: 'dar' | 'restablecer') {
  const user = userEvent.setup()
  render(<AccesoAppDialog residente={residente} modo={modo} trigger={<button>Abrir</button>} />)
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

describe('AccesoAppDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('en modo dar muestra teléfono y contraseña', async () => {
    await abrir('dar')
    expect(screen.getByLabelText('Teléfono')).toHaveValue('3312345678')
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
  })

  it('rechaza una contraseña de menos de 8 caracteres sin llamar a la acción', async () => {
    const user = await abrir('dar')
    await user.type(screen.getByLabelText('Contraseña'), 'corta')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument()
    expect(darAccesoApp).not.toHaveBeenCalled()
  })

  it('llama a darAccesoApp con teléfono y contraseña', async () => {
    darAccesoApp.mockResolvedValue({ ok: true, data: { cuentaCreada: true } })
    const user = await abrir('dar')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(darAccesoApp).toHaveBeenCalledWith(3, { telefono: '3312345678', password: 'secreta123' }),
    )
  })

  it('avisa que se vinculó la cuenta existente cuando cuentaCreada es false', async () => {
    darAccesoApp.mockResolvedValue({ ok: true, data: { cuentaCreada: false } })
    const user = await abrir('dar')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(success).toHaveBeenCalledWith(expect.stringContaining('Se vinculó la cuenta existente')))
  })
})
