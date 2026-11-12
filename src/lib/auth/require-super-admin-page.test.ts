import { notFound } from 'next/navigation'
import type { TenantContext } from '@/lib/auth/tenant-context'

const getTenantContext = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getTenantContext: () => getTenantContext(),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

import { requireSuperAdminPage } from './require-super-admin-page'

const SUPER: TenantContext = {
  userId: 'u0',
  email: 'root@plataforma.mx',
  perfil: { nombre: 'Root', email: 'root@plataforma.mx', rol: 'super_admin', activo: true, fraccionamientoId: null },
  fraccionamiento: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireSuperAdminPage', () => {
  it('tesorero → notFound()', async () => {
    getTenantContext.mockResolvedValue({
      ...SUPER,
      perfil: { ...SUPER.perfil!, rol: 'tesorero', fraccionamientoId: 7 },
      fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
    })
    await expect(requireSuperAdminPage()).rejects.toThrow('NOT_FOUND')
  })

  it('sin sesión → notFound()', async () => {
    getTenantContext.mockResolvedValue(null)
    await expect(requireSuperAdminPage()).rejects.toThrow('NOT_FOUND')
  })

  it('super admin inactivo → notFound()', async () => {
    getTenantContext.mockResolvedValue({ ...SUPER, perfil: { ...SUPER.perfil!, activo: false } })
    await expect(requireSuperAdminPage()).rejects.toThrow('NOT_FOUND')
  })

  it('super admin activo continúa', async () => {
    getTenantContext.mockResolvedValue(SUPER)
    await expect(requireSuperAdminPage()).resolves.toBeUndefined()
    expect(notFound).not.toHaveBeenCalled()
  })
})
