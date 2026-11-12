import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { actualizarDomicilio, crearDomicilio, forzarAcceso } from './actions'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn(), instalacionDe: vi.fn().mockResolvedValue(null) }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))

const user = { id: 'u1', email: 'a@b.c', userName: 'Ana', roleName: 'administrador', isActive: true }
const input = { direccion: 'lago 1', fechaAlta: '2026-01-01', observaciones: '' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
})

describe('crearDomicilio', () => {
  test('rechaza duplicado', async () => {
    const info = fakeQuery({ data: [{ id: 1 }] })
    const domicilios = fakeQuery()
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase({ domicilios_info: info, domicilios }) as never,
    )
    const r = await crearDomicilio(input)
    expect(r).toEqual({ ok: false, error: 'Este domicilio ya se encuentra registrado.' })
    expect(callsOf(domicilios, 'insert')).toHaveLength(0)
    expect(callsOf(info, 'eq')[0].args).toEqual(['direccion', 'LAGO 1'])
  })

  test('inserta con created_by y concepto', async () => {
    const domicilios = fakeQuery({ data: { id: 7 } })
    const concepto = fakeQuery()
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase({ domicilios_info: fakeQuery({ data: [] }), domicilios, domicilio_concepto: concepto }) as never,
    )
    const r = await crearDomicilio({ ...input, conceptoId: '2' })
    expect(r).toEqual({ ok: true, data: { id: 7 } })
    expect(callsOf(domicilios, 'insert')[0].args).toEqual([
      { direccion: 'LAGO 1', fecha_alta: '2026-01-01', observaciones: null, created_by: 'u1' },
    ])
    expect(callsOf(concepto, 'insert')[0].args).toEqual([{ domicilio_id: 7, concepto_id: 2 }])
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios')
  })

  test('sin concepto no toca domicilio_concepto', async () => {
    const concepto = fakeQuery()
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase({
        domicilios_info: fakeQuery({ data: [] }),
        domicilios: fakeQuery({ data: { id: 7 } }),
        domicilio_concepto: concepto,
      }) as never,
    )
    const r = await crearDomicilio(input)
    expect(r.ok).toBe(true)
    expect(concepto.calls).toHaveLength(0)
  })

  test('cualquier rol autenticado puede crear', async () => {
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase({ domicilios_info: fakeQuery({ data: [] }), domicilios: fakeQuery({ data: { id: 1 } }) }) as never,
    )
    expect((await crearDomicilio(input)).ok).toBe(true)
  })

  test('devuelve el primer error de validación', async () => {
    const r = await crearDomicilio({ ...input, direccion: ' ' })
    expect(r).toEqual({ ok: false, error: 'La dirección es obligatoria' })
  })
})

describe('actualizarDomicilio', () => {
  test('hace update y crea domicilio_concepto si no existe', async () => {
    const domicilios = fakeQuery({ data: { direccion: 'LAGO 1', observaciones: null } })
    const concepto = fakeQuery({ data: null })
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase({ domicilios, domicilio_concepto: concepto }) as never,
    )
    const r = await actualizarDomicilio(5, { ...input, conceptoId: 3 })
    expect(r.ok).toBe(true)
    expect(callsOf(domicilios, 'update')[0].args).toEqual([
      { direccion: 'LAGO 1', fecha_alta: '2026-01-01', observaciones: null },
    ])
    expect(callsOf(domicilios, 'eq')[0].args).toEqual(['id', 5])
    expect(callsOf(concepto, 'insert')[0].args).toEqual([{ domicilio_id: 5, concepto_id: 3 }])
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios')
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/5')
  })

  test('actualiza domicilio_concepto existente', async () => {
    const concepto = fakeQuery({ data: { id: 9, domicilio_id: 5, concepto_id: 1 } })
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase({
        domicilios: fakeQuery({ data: { direccion: 'LAGO 1', observaciones: null } }),
        domicilio_concepto: concepto,
      }) as never,
    )
    const r = await actualizarDomicilio(5, { ...input, conceptoId: 3 })
    expect(r.ok).toBe(true)
    expect(callsOf(concepto, 'update')[0].args).toEqual([{ concepto_id: 3 }])
    expect(callsOf(concepto, 'eq').at(-1)!.args).toEqual(['id', 9])
    expect(callsOf(concepto, 'insert')).toHaveLength(0)
  })
})

describe('permisos', () => {
  test('un tesorero no puede crear ni actualizar domicilios', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, roleName: 'tesorero' } as never)
    expect(await crearDomicilio(input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await actualizarDomicilio(1, input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('forzarAcceso', () => {
  test('mapea P0001 al mensaje de estado repetido', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'x' } })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({}, { rpc }) as never)
    const r = await forzarAcceso(5, 'activo')
    expect(r).toEqual({ ok: false, error: 'El acceso ya está en ese estado' })
    expect(rpc).toHaveBeenCalledWith('forzar_acceso', { p_domicilio_id: 5, p_valor: 'activo' })
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('solo administrador', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, roleName: 'tesorero' } as never)
    const rpc = vi.fn()
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({}, { rpc }) as never)
    const r = await forzarAcceso(5, 'activo')
    expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(rpc).not.toHaveBeenCalled()
  })

  test('éxito dispara sincronización si hay instalación', async () => {
    vi.mocked(instalacionDe).mockResolvedValueOnce({ fid: 3, instalacionId: 'i' })
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({}, { rpc }) as never)
    expect(await forzarAcceso(5, null)).toEqual({ ok: true, data: undefined })
    expect(dispararSincronizacion).toHaveBeenCalledWith(3)
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/5')
  })
})
