import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { requireSuperAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { guardarReglasCobroConsola } from './actions'
import { REGLAS_COBRO_POR_OMISION } from './schemas'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/require-role', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/require-role')>()),
  requireSuperAdmin: vi.fn(),
}))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn(), getTenantContext: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', async (orig) => ({
  ...(await orig<typeof import('@/features/sincronizacion/cola')>()),
  instalacionDe: vi.fn(),
}))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))

const rpc = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: 0, error: null })
  vi.mocked(getTenantContext).mockResolvedValue({ userId: 'sa', fraccionamiento: null } as never)
  vi.mocked(instalacionDe).mockResolvedValue(null)
})

describe('guardarReglasCobroConsola', () => {
  test('sin ser super admin → sin permiso', async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError('FORBIDDEN'))
    expect(await guardarReglasCobroConsola(9, REGLAS_COBRO_POR_OMISION)).toEqual({ ok: false, error: MSG_NO_PERMISO })
  })

  test('super admin: upsert con el fraccionamiento explícito y recálculo', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ id: 'sa', email: 'x@y.z' })
    const q = fakeQuery()
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ reglas_cobro: q }, { rpc }) as never)
    expect((await guardarReglasCobroConsola(9, REGLAS_COBRO_POR_OMISION)).ok).toBe(true)
    expect((callsOf(q, 'upsert')[0].args[0] as { fraccionamiento_id: number }).fraccionamiento_id).toBe(9)
    expect(rpc).toHaveBeenCalledWith('recalcular_permisos_acceso', { p_fraccionamiento_id: 9 })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/9')
  })
})
