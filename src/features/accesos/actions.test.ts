import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { encolar, instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import {
  actualizarTarjeta,
  crearTarjeta,
  crearTelefono,
  eliminarTarjeta,
  eliminarTelefono,
} from './actions'
import { MSG_ACCESO_NO_ENCONTRADO, MSG_MAX_TARJETAS, MSG_MAX_TELEFONOS } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn(), instalacionDe: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))

const user = { id: 'u1', email: 'a@b.c', userName: 'Ana', roleName: 'administrador', isActive: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  vi.mocked(instalacionDe).mockResolvedValue({ fid: 7, instalacionId: 'inst-1' })
  vi.mocked(encolar).mockResolvedValue(undefined)
})

const tareas = () => vi.mocked(encolar).mock.calls.flatMap(([, t]) => t)
const usar = (tables: Parameters<typeof fakeSupabase>[0]) => {
  const sb = fakeSupabase(tables)
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return sb
}

describe('crearTelefono', () => {
  test('falla sin insertar si ya hay 2', async () => {
    const q = fakeQuery({ count: 2 })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ telefonos_acceso: q }) as never)
    const r = await crearTelefono(9, '5512345678')
    expect(r).toEqual({ ok: false, error: MSG_MAX_TELEFONOS })
    expect(callsOf(q, 'insert')).toHaveLength(0)
  })

  test('inserta si hay menos del límite', async () => {
    const q = fakeQuery({ count: 1 })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ telefonos_acceso: q }) as never)
    const r = await crearTelefono(9, '5512345678')
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(q, 'insert')[0].args).toEqual([{ domicilio_id: 9, telefono: '5512345678' }])
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
  })

  test('rechaza valor inválido', async () => {
    const q = fakeQuery({ count: 0 })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ telefonos_acceso: q }) as never)
    const r = await crearTelefono(9, '55-12')
    expect(r).toEqual({ ok: false, error: 'Solo dígitos, máximo 10' })
    expect(callsOf(q, 'insert')).toHaveLength(0)
  })
})

describe('eliminarTelefono', () => {
  test('elimina por id y revalida', async () => {
    const q = fakeQuery()
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ telefonos_acceso: q }) as never)
    const r = await eliminarTelefono(4, 9)
    expect(r.ok).toBe(true)
    expect(callsOf(q, 'delete')).toHaveLength(1)
    expect(callsOf(q, 'eq')[0].args).toEqual(['id', 4])
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
  })
})

describe('crearTarjeta', () => {
  test('falla sin insertar si ya hay 3', async () => {
    const q = fakeQuery({ count: 3 })
    usar({ tarjetas_acceso: q })
    const r = await crearTarjeta(9, { numero: '123' })
    expect(r).toEqual({ ok: false, error: MSG_MAX_TARJETAS })
    expect(callsOf(q, 'insert')).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('rechaza un número que no cabe en 32 bits', async () => {
    const q = fakeQuery({ count: 0 })
    usar({ tarjetas_acceso: q })
    const r = await crearTarjeta(9, { numero: '4294967296' })
    expect(r).toEqual({ ok: false, error: 'El número excede 32 bits (máximo 4294967295)' })
    expect(callsOf(q, 'insert')).toHaveLength(0)
  })

  test('rechaza una descripción de más de 60 caracteres', async () => {
    usar({ tarjetas_acceso: fakeQuery({ count: 0 }) })
    const r = await crearTarjeta(9, { numero: '123', descripcion: 'x'.repeat(61) })
    expect(r).toEqual({ ok: false, error: 'Máximo 60 caracteres' })
  })

  test('inserta con descripción y encola tarjeta crear con el id nuevo', async () => {
    const conteo = fakeQuery({ count: 1 })
    const insert = fakeQuery({ data: { id: 31 } })
    usar({ tarjetas_acceso: [conteo, insert] })
    const r = await crearTarjeta(9, { numero: '4294967295', descripcion: ' Auto ' })
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(insert, 'insert')[0].args).toEqual([{ domicilio_id: 9, numero: '4294967295', descripcion: 'Auto' }])
    expect(tareas()).toEqual([
      { fraccionamientoId: 7, domicilioId: 9, entidad: 'tarjeta', entidadId: 31, operacion: 'crear' },
    ])
    expect(dispararSincronizacion).toHaveBeenCalledWith(7)
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
  })

  test('si no se puede encolar, borra la tarjeta recién creada para poder reintentar', async () => {
    vi.mocked(encolar).mockRejectedValue(new Error('cola caída'))
    const insert = fakeQuery({ data: { id: 31 } })
    const borrar = fakeQuery()
    usar({ tarjetas_acceso: [fakeQuery({ count: 0 }), insert, borrar] })
    expect((await crearTarjeta(9, { numero: '123' })).ok).toBe(false)
    expect(callsOf(borrar, 'delete')).toHaveLength(1)
    expect(callsOf(borrar, 'eq')[0].args).toEqual(['id', 31])
  })

  test('sin instalación inserta sin encolar', async () => {
    vi.mocked(instalacionDe).mockResolvedValue(null)
    usar({ tarjetas_acceso: [fakeQuery({ count: 0 }), fakeQuery({ data: { id: 31 } })] })
    expect((await crearTarjeta(9, { numero: '123' })).ok).toBe(true)
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })
})

describe('actualizarTarjeta', () => {
  test('solo cambia la descripción y encola tarjeta actualizar antes de escribir', async () => {
    const lectura = fakeQuery({ data: { id: 5, domicilio_id: 9, tarjeta_id: 'tj-1' } })
    const update = fakeQuery()
    usar({ tarjetas_acceso: [lectura, update] })
    const r = await actualizarTarjeta(5, 9, 'Moto')
    expect(r.ok).toBe(true)
    expect(callsOf(update, 'update')[0].args).toEqual([{ descripcion: 'Moto' }])
    expect(callsOf(update, 'eq')[0].args).toEqual(['id', 5])
    expect(tareas()).toEqual([
      { fraccionamientoId: 7, domicilioId: 9, entidad: 'tarjeta', entidadId: 5, operacion: 'actualizar' },
    ])
    expect(vi.mocked(encolar).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(dispararSincronizacion).mock.invocationCallOrder[0],
    )
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
  })

  test('descripción vacía se guarda como nula', async () => {
    const update = fakeQuery()
    usar({ tarjetas_acceso: [fakeQuery({ data: { id: 5, domicilio_id: 9, tarjeta_id: null } }), update] })
    await actualizarTarjeta(5, 9, '  ')
    expect(callsOf(update, 'update')[0].args).toEqual([{ descripcion: null }])
  })

  test('si la tarjeta ya no existe no encola', async () => {
    usar({ tarjetas_acceso: fakeQuery({ data: null }) })
    expect(await actualizarTarjeta(5, 9, 'Moto')).toEqual({ ok: false, error: MSG_ACCESO_NO_ENCONTRADO })
    expect(encolar).not.toHaveBeenCalled()
  })
})

describe('eliminarTarjeta', () => {
  test('encola borrar con tarjeta_id ANTES de borrar la fila', async () => {
    const lectura = fakeQuery({ data: { id: 5, domicilio_id: 9, tarjeta_id: 'tj-1' } })
    const borrar = fakeQuery()
    usar({ tarjetas_acceso: [lectura, borrar] })
    let filaBorradaAlEncolar = true
    vi.mocked(encolar).mockImplementation(async () => {
      filaBorradaAlEncolar = callsOf(borrar, 'delete').length > 0
    })

    const r = await eliminarTarjeta(5, 9)

    expect(r.ok).toBe(true)
    expect(tareas()).toEqual([
      {
        fraccionamientoId: 7,
        domicilioId: 9,
        entidad: 'tarjeta',
        entidadId: 5,
        operacion: 'borrar',
        carga: { tarjeta_id: 'tj-1' },
      },
    ])
    expect(filaBorradaAlEncolar).toBe(false)
    expect(callsOf(borrar, 'delete')).toHaveLength(1)
    expect(dispararSincronizacion).toHaveBeenCalledWith(7)
  })

  test('si no se puede encolar no borra la fila', async () => {
    vi.mocked(encolar).mockRejectedValue(new Error('cola caída'))
    const borrar = fakeQuery()
    usar({ tarjetas_acceso: [fakeQuery({ data: { id: 5, domicilio_id: 9, tarjeta_id: 'tj-1' } }), borrar] })
    expect((await eliminarTarjeta(5, 9)).ok).toBe(false)
    expect(callsOf(borrar, 'delete')).toHaveLength(0)
  })
})

describe('permisos', () => {
  test('un tesorero no puede escribir teléfonos ni tarjetas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, roleName: 'tesorero' } as never)
    expect(await crearTelefono(9, '5512345678')).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await eliminarTelefono(1, 9)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await crearTarjeta(9, { numero: '123' })).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await actualizarTarjeta(1, 9, 'Auto')).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await eliminarTarjeta(1, 9)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createClient).not.toHaveBeenCalled()
  })
})
