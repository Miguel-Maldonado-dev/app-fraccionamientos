import { notFound } from 'next/navigation'
import type { TenantContext } from '@/lib/auth/tenant-context'

const getTenantContext = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getTenantContext: () => getTenantContext(),
}))
vi.mock('@/features/auth/actions', () => ({ logout: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

import AdminLayout from './layout'

const SUPER: TenantContext = {
  userId: 'u0',
  email: 'root@plataforma.mx',
  perfil: { nombre: 'Root', email: 'root@plataforma.mx', rol: 'super_admin', activo: true, fraccionamientoId: null },
  fraccionamiento: null,
}

const render = () => AdminLayout({ children: null })

describe('admin layout', () => {
  it('administrador de fraccionamiento → notFound()', async () => {
    getTenantContext.mockResolvedValue({
      ...SUPER,
      perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 7 },
      fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
    })
    await expect(render()).rejects.toThrow('NOT_FOUND')
  })

  it('sin sesión → notFound()', async () => {
    getTenantContext.mockResolvedValue(null)
    await expect(render()).rejects.toThrow('NOT_FOUND')
  })

  it('super admin inactivo → notFound()', async () => {
    getTenantContext.mockResolvedValue({ ...SUPER, perfil: { ...SUPER.perfil!, activo: false } })
    await expect(render()).rejects.toThrow('NOT_FOUND')
  })

  it('super admin activo renderiza con el menú', async () => {
    getTenantContext.mockResolvedValue(SUPER)
    const { render: rtl, screen } = await import('@testing-library/react')
    rtl(await render())
    expect(screen.getAllByRole('img', { name: 'WEADMI' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Fraccionamientos' })).toHaveAttribute('href', '/admin/fraccionamientos')
    expect(screen.getAllByText('Consola de plataforma').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Root').length).toBeGreaterThan(0)
    expect(notFound).not.toHaveBeenCalled()
  })
})
