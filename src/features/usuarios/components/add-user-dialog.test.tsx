import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { crearUsuario } from '../actions'
import { MSG_USUARIO_CREADO } from '../messages'
import { AddUserDialog } from './add-user-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../actions', () => ({ crearUsuario: vi.fn() }))

const valores = { userName: 'Ana', email: 'ana@lago.mx', password: '123456', rol: 'administrador' }

async function llenarYCrear() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Nuevo usuario/i }))
  await user.type(screen.getByLabelText(/Nombre/), valores.userName)
  await user.type(screen.getByLabelText(/Email/), valores.email)
  await user.type(screen.getByLabelText(/Contraseña/), valores.password)
  await user.click(screen.getByRole('combobox'))
  await user.click(screen.getByRole('option', { name: 'Administrador' }))
  await user.click(screen.getByRole('button', { name: 'Crear' }))
}

describe('AddUserDialog', () => {
  beforeEach(() => {
    vi.mocked(crearUsuario).mockReset().mockResolvedValue({ ok: true, data: undefined })
    vi.mocked(toast.success).mockReset()
  })

  it('sin prop usa crearUsuario', async () => {
    render(<AddUserDialog />)
    await llenarYCrear()
    expect(crearUsuario).toHaveBeenCalledWith(valores)
    expect(toast.success).toHaveBeenCalledWith(MSG_USUARIO_CREADO)
  })

  it('con la prop crear llama a esa función y no a crearUsuario', async () => {
    const crear = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    render(<AddUserDialog crear={crear} />)
    await llenarYCrear()
    expect(crear).toHaveBeenCalledWith(valores)
    expect(crearUsuario).not.toHaveBeenCalled()
  })
})
