import { beforeEach, describe, expect, test, vi } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import type { TareaNueva } from './tipos'

const getTenantContext = vi.fn()
vi.mock('@/lib/auth/tenant-context', () => ({ getTenantContext: () => getTenantContext() }))

import { encolar, encolarSiHayInstalacion, instalacionDe, recalcularPermisos } from './cola'

const tarea = (o: Partial<TareaNueva> = {}): TareaNueva => ({
  fraccionamientoId: 1, domicilioId: 5, entidad: 'tarjeta', entidadId: 9, operacion: 'crear', ...o,
})

beforeEach(() => getTenantContext.mockReset())

describe('encolar', () => {
  test('un solo insert en snake_case con carga {} por defecto', async () => {
    const q = fakeQuery()
    const sb = fakeSupabase({ sincronizaciones_acceso: q }) as never
    await encolar(sb, [tarea(), tarea({ entidad: 'pin', entidadId: null, operacion: 'fijar', carga: { pin: '1' } })])
    expect(callsOf(q, 'insert')).toHaveLength(1)
    expect(callsOf(q, 'insert')[0].args[0]).toEqual([
      { fraccionamiento_id: 1, domicilio_id: 5, entidad: 'tarjeta', entidad_id: 9, operacion: 'crear', carga: {} },
      { fraccionamiento_id: 1, domicilio_id: 5, entidad: 'pin', entidad_id: null, operacion: 'fijar', carga: { pin: '1' } },
    ])
  })

  test('arreglo vacío no llama a la base', async () => {
    const sb = fakeSupabase({}) as never
    await encolar(sb, [])
    expect((sb as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()
  })

  test('lanza con el mensaje del error', async () => {
    const sb = fakeSupabase({ sincronizaciones_acceso: fakeQuery({ error: { message: 'boom' } }) }) as never
    await expect(encolar(sb, [tarea()])).rejects.toThrow('boom')
  })
})

describe('instalacionDe', () => {
  test('devuelve fid e instalación; null sin instalación o sin fraccionamiento', async () => {
    const con = fakeSupabase({ fraccionamientos: fakeQuery({ data: { instalacion_id: 'i-1' } }) }) as never
    expect(await instalacionDe(con, 7)).toEqual({ fid: 7, instalacionId: 'i-1' })
    const sin = fakeSupabase({ fraccionamientos: fakeQuery({ data: { instalacion_id: null } }) }) as never
    expect(await instalacionDe(sin, 7)).toBeNull()
    getTenantContext.mockResolvedValue(null)
    expect(await instalacionDe(sin, null)).toBeNull()
  })
})

describe('encolarSiHayInstalacion', () => {
  test('sin instalacion_id devuelve false y no inserta', async () => {
    const cola = fakeQuery()
    const sb = fakeSupabase({
      fraccionamientos: fakeQuery({ data: { instalacion_id: null } }),
      sincronizaciones_acceso: cola,
    }) as never
    const fabrica = vi.fn((fid: number) => [tarea({ fraccionamientoId: fid })])
    expect(await encolarSiHayInstalacion(sb, 1, fabrica)).toBe(false)
    expect(fabrica).not.toHaveBeenCalled()
    expect(callsOf(cola, 'insert')).toHaveLength(0)
  })

  test('con instalación encola lo que arma la fábrica', async () => {
    const fr = fakeQuery({ data: { instalacion_id: 'abc' } })
    const cola = fakeQuery()
    const sb = fakeSupabase({ fraccionamientos: fr, sincronizaciones_acceso: cola }) as never
    expect(await encolarSiHayInstalacion(sb, 7, (fid) => [tarea({ fraccionamientoId: fid })])).toBe(true)
    expect(callsOf(fr, 'select')[0].args).toEqual(['instalacion_id'])
    expect(callsOf(fr, 'eq')[0].args).toEqual(['id', 7])
    expect((callsOf(cola, 'insert')[0].args[0] as { fraccionamiento_id: number }[])[0].fraccionamiento_id).toBe(7)
  })

  test('sin id usa el fraccionamiento del contexto', async () => {
    getTenantContext.mockResolvedValue({ fraccionamiento: { id: 3, nombre: 'X' } })
    const fr = fakeQuery({ data: { instalacion_id: 'abc' } })
    const sb = fakeSupabase({ fraccionamientos: fr, sincronizaciones_acceso: fakeQuery() }) as never
    expect(await encolarSiHayInstalacion(sb, null, (fid) => [tarea({ fraccionamientoId: fid })])).toBe(true)
    expect(callsOf(fr, 'eq')[0].args).toEqual(['id', 3])
  })

  test('sin id ni contexto devuelve false', async () => {
    getTenantContext.mockResolvedValue(null)
    const sb = fakeSupabase({}) as never
    expect(await encolarSiHayInstalacion(sb, null, () => [tarea()])).toBe(false)
  })
})

describe('recalcularPermisos', () => {
  test('llama al rpc y devuelve el conteo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 4, error: null })
    const sb = fakeSupabase({}, { rpc }) as never
    expect(await recalcularPermisos(sb, 2)).toBe(4)
    expect(rpc).toHaveBeenCalledWith('recalcular_permisos_acceso', { p_fraccionamiento_id: 2 })
  })

  test('lanza si el rpc falla', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } })
    await expect(recalcularPermisos(fakeSupabase({}, { rpc }) as never, 2)).rejects.toThrow('nope')
  })
})
