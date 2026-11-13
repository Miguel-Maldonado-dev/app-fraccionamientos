import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getCurrentUser, getTenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { guardarMaxResidentesApp } from './actions'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn(), instalacionDe: vi.fn(), recalcularPermisos: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getCurrentUser: vi.fn(),
  getTenantContext: vi.fn(),
}))

const admin = { id: 'u1', email: 'a@b.c', userName: 'Ana', roleName: 'administrador', isActive: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(admin as never)
  vi.mocked(getTenantContext).mockResolvedValue({ fraccionamiento: { id: 3 } } as never)
})

describe('guardarMaxResidentesApp', () => {
  test('rechaza a quien no es administrador', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...admin, roleName: 'tesorero' } as never)
    expect((await guardarMaxResidentesApp(5)).ok).toBe(false)
    expect(createClient).not.toHaveBeenCalled()
  })

  test.each([0, 21, 2.5, Number.NaN])('rechaza %s', async (v) => {
    const r = await guardarMaxResidentesApp(v)
    expect(r).toEqual({ ok: false, error: 'Debe ser un número entre 1 y 20' })
    expect(createClient).not.toHaveBeenCalled()
  })

  test('actualiza solo max_residentes_app del fraccionamiento', async () => {
    const q = fakeQuery()
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ fraccionamientos: q }) as never)
    expect((await guardarMaxResidentesApp(8)).ok).toBe(true)
    expect(callsOf(q, 'update')[0].args).toEqual([{ max_residentes_app: 8 }])
    expect(callsOf(q, 'eq')[0].args).toEqual(['id', 3])
  })
})
