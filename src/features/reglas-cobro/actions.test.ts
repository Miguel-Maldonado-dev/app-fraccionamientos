import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { getCurrentUser, getTenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { guardarReglasCobro } from './actions'
import { MSG_RECARGO_NO_VALIDO } from './messages'
import { REGLAS_COBRO_POR_OMISION } from './schemas'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn(), getTenantContext: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', async (orig) => ({
  ...(await orig<typeof import('@/features/sincronizacion/cola')>()),
  instalacionDe: vi.fn(),
}))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))

const usuario = (roleName: string) => ({ id: 'u1', email: 'a@b.c', userName: 'Ana', roleName, isActive: true })
const rpc = vi.fn()

function usar(error: unknown = null) {
  const q = fakeQuery({ error })
  const sb = fakeSupabase({ reglas_cobro: q }, { rpc })
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return q
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: 2, error: null })
  vi.mocked(getCurrentUser).mockResolvedValue(usuario('administrador') as never)
  vi.mocked(getTenantContext).mockResolvedValue({ userId: 'u1', fraccionamiento: { id: 7 } } as never)
  vi.mocked(instalacionDe).mockResolvedValue({ fid: 7, instalacionId: 'inst' })
})

const input = { ...REGLAS_COBRO_POR_OMISION, diaVencimiento: 31, diasGracia: 5, conceptoRecargoId: 3 }

describe('guardarReglasCobro', () => {
  test('tesorero → falla por permisos sin escribir', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(usuario('tesorero') as never)
    const q = usar()
    expect(await guardarReglasCobro(input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(callsOf(q, 'upsert')).toHaveLength(0)
    expect(rpc).not.toHaveBeenCalled()
  })

  test('administrador: upsert y recalcula permisos del fraccionamiento', async () => {
    const q = usar()
    expect(await guardarReglasCobro(input)).toEqual({ ok: true, data: undefined })
    const [fila] = callsOf(q, 'upsert')[0].args as [Record<string, unknown>]
    expect(fila).toMatchObject({
      fraccionamiento_id: 7,
      dia_generacion: null,
      dia_vencimiento: 31,
      dias_gracia: 5,
      cuotas_para_moroso: 1,
      concepto_recargo_id: 3,
      updated_by: 'u1',
    })
    expect(fila).not.toHaveProperty('recargo_desde')
    expect(rpc).toHaveBeenCalledWith('recalcular_permisos_acceso', { p_fraccionamiento_id: 7 })
    expect(dispararSincronizacion).toHaveBeenCalledWith(7)
    expect(revalidatePath).toHaveBeenCalledWith('/configuracion')
  })

  test('sin instalación recalcula pero no dispara sincronización', async () => {
    vi.mocked(instalacionDe).mockResolvedValue(null)
    usar()
    await guardarReglasCobro(input)
    expect(rpc).toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('valores fuera de rango → error de validación sin escribir', async () => {
    const q = usar()
    const r = await guardarReglasCobro({ ...input, diaGeneracion: 29 })
    expect(r.ok).toBe(false)
    expect(callsOf(q, 'upsert')).toHaveLength(0)
  })

  test('concepto de otro fraccionamiento (23503) → mensaje', async () => {
    usar({ code: '23503', message: 'fk' })
    expect(await guardarReglasCobro(input)).toEqual({ ok: false, error: MSG_RECARGO_NO_VALIDO })
    expect(rpc).not.toHaveBeenCalled()
  })

  test('un fallo al recalcular no tumba el guardado', async () => {
    usar()
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await guardarReglasCobro(input)).ok).toBe(true)
  })
})
