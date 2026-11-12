import { render, screen } from '@testing-library/react'

const getTenantContext = vi.fn()
vi.mock('@/lib/auth/tenant-context', () => ({ getTenantContext: () => getTenantContext() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

import SinAccesoPage from './page'

describe('/sin-acceso', () => {
  it('sin sesión → /login', async () => {
    getTenantContext.mockResolvedValue(null)
    await expect(SinAccesoPage()).rejects.toThrow('REDIRECT /login')
  })

  it('muestra el mensaje exacto y el botón Cerrar sesión hacia /api/auth/signout', async () => {
    getTenantContext.mockResolvedValue({ userId: 'u1', email: 'a@b.c', perfil: null, fraccionamiento: null })

    render(await SinAccesoPage())

    expect(screen.getByRole('img', { name: 'WEADMI' })).toBeInTheDocument()
    expect(screen.getByText('Tu acceso está desactivado. Contacta al administrador.')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Cerrar sesión' })
    expect(button.closest('form')).toHaveAttribute('action', '/api/auth/signout')
  })
})
