import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { fakeSupabase } from '@/test/fake-query'
import { cancelarCuotas, reactivarCuota } from './cancelacion-actions'
import { MSG_CUOTA_NO_CANCELADA, MSG_CUOTAS_NO_CANCELABLES } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ instalacionDe: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))

const userWith = (roleName: string) =>
  ({ id: 'u1', email: 'a@b.c', userName: 'Ana', roleName, isActive: true }) as never

function setup(opts: { role?: string; data?: unknown; error?: unknown } = {}) {
  vi.mocked(getCurrentUser).mockResolvedValue(userWith(opts.role ?? 'administrador'))
  const rpc = vi.fn().mockResolvedValue({ data: opts.data ?? null, error: opts.error ?? null })
  vi.mocked(createClient).mockResolvedValue(fakeSupabase({}, { rpc }) as never)
  return rpc
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(instalacionDe).mockResolvedValue(null)
})

describe('cancelarCuotas', () => {
  test('tesorero: sin permiso y no llama al rpc', async () => {
    const rpc = setup({ role: 'tesorero' })
    const r = await cancelarCuotas(5, [1, 2], 'Error de captura')
    expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(rpc).not.toHaveBeenCalled()
  })

  test('motivo corto: error y no llama al rpc', async () => {
    const rpc = setup()
    const r = await cancelarCuotas(5, [1], '  ab ')
    expect(r.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  test('sin cuotas: error', async () => {
    const rpc = setup()
    expect((await cancelarCuotas(5, [], 'Motivo válido')).ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  test('ok: devuelve canceladas, recorta el motivo y revalida', async () => {
    const rpc = setup({ data: 2 })
    const r = await cancelarCuotas(5, [1, 2], '  Error de captura  ')
    expect(r).toEqual({ ok: true, data: { canceladas: 2 } })
    expect(rpc).toHaveBeenCalledWith('cancelar_cuotas', { p_cuota_ids: [1, 2], p_motivo: 'Error de captura' })
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/5')
    expect(revalidatePath).toHaveBeenCalledWith('/cuotas')
  })

  test('con instalación dispara la sincronización', async () => {
    vi.mocked(instalacionDe).mockResolvedValue({ fid: 1, instalacionId: 'i' })
    setup({ data: 1 })
    await cancelarCuotas(5, [1], 'Motivo válido')
    expect(dispararSincronizacion).toHaveBeenCalledWith(1)
  })

  test('error de negocio del rpc: muestra su mensaje', async () => {
    setup({ error: { code: 'P0001', message: 'Las cuotas deben ser de un mismo domicilio' } })
    const r = await cancelarCuotas(5, [3], 'Motivo válido')
    expect(r).toEqual({ ok: false, error: 'Las cuotas deben ser de un mismo domicilio' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('mensaje de negocio desconocido: mensaje fijo', async () => {
    setup({ error: { code: 'P0001', message: 'detalle interno raro' } })
    expect(await cancelarCuotas(5, [3], 'Motivo válido')).toEqual({ ok: false, error: MSG_CUOTAS_NO_CANCELABLES })
  })

  test('error inesperado: mensaje genérico', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setup({ error: { code: 'XX000', message: 'boom' } })
    const r = await cancelarCuotas(5, [3], 'Motivo válido')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).not.toContain('boom')
  })
})

describe('reactivarCuota', () => {
  test('tesorero: sin permiso', async () => {
    const rpc = setup({ role: 'tesorero' })
    expect(await reactivarCuota(5, 1)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(rpc).not.toHaveBeenCalled()
  })

  test('ok: llama al rpc y revalida', async () => {
    const rpc = setup({ data: 1 })
    expect(await reactivarCuota(5, 9)).toEqual({ ok: true, data: undefined })
    expect(rpc).toHaveBeenCalledWith('reactivar_cuota', { p_cuota_id: 9 })
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/5')
    expect(revalidatePath).toHaveBeenCalledWith('/cuotas')
  })

  test('P0001: muestra el mensaje del rpc', async () => {
    setup({ error: { code: 'P0001', message: 'La cuota no está cancelada' } })
    expect(await reactivarCuota(5, 9)).toEqual({ ok: false, error: 'La cuota no está cancelada' })
  })

  test('ids inválidos', async () => {
    const rpc = setup()
    expect(await reactivarCuota(5, 0)).toEqual({ ok: false, error: MSG_CUOTA_NO_CANCELADA })
    expect(rpc).not.toHaveBeenCalled()
  })
})
