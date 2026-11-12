import { notFound, redirect } from 'next/navigation'
import type { TenantContext } from '@/lib/auth/tenant-context'

const getTenantContext = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getTenantContext: () => getTenantContext(),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => null }))
vi.mock('@/components/layout/app-bar', () => ({ AppBar: () => null }))

import AppLayout, { generateMetadata } from './layout'

const base: TenantContext = {
  userId: 'u1',
  email: 'ana@lago.mx',
  perfil: { nombre: 'Ana', email: 'ana@lago.mx', rol: 'administrador', activo: true, fraccionamientoId: 7 },
  fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
}

const render = () => AppLayout({ children: null })

describe('(app) layout', () => {
  it('sin sesión → /login', async () => {
    getTenantContext.mockResolvedValue(null)
    await expect(render()).rejects.toThrow('REDIRECT /login')
  })

  it('super admin → /admin', async () => {
    getTenantContext.mockResolvedValue({
      ...base,
      perfil: { ...base.perfil!, rol: 'super_admin', fraccionamientoId: null },
      fraccionamiento: null,
    })
    await expect(render()).rejects.toThrow('REDIRECT /admin')
  })

  it('sin perfil → /sin-acceso', async () => {
    getTenantContext.mockResolvedValue({ ...base, perfil: null, fraccionamiento: null })
    await expect(render()).rejects.toThrow('REDIRECT /sin-acceso')
  })

  it('perfil inactivo → /sin-acceso', async () => {
    getTenantContext.mockResolvedValue({ ...base, perfil: { ...base.perfil!, activo: false } })
    await expect(render()).rejects.toThrow('REDIRECT /sin-acceso')
  })

  it('miembro con acceso renderiza el shell', async () => {
    getTenantContext.mockResolvedValue(base)
    await expect(render()).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('generateMetadata usa el nombre del fraccionamiento', async () => {
    getTenantContext.mockResolvedValue(base)
    await expect(generateMetadata()).resolves.toEqual({ title: 'Fracc Demo · WEADMI' })
  })

  it('generateMetadata sin fraccionamiento usa solo el producto', async () => {
    getTenantContext.mockResolvedValue(null)
    await expect(generateMetadata()).resolves.toEqual({ title: 'WEADMI' })
  })
})
