import { describe, expect, test } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { estadoDeEntidades, estadoDomicilio, listTareasAbiertas, resumenSincronizacion } from './queries'

describe('estadoDeEntidades', () => {
  test('se queda con la tarea más reciente por entidad_id', async () => {
    const q = fakeQuery({
      data: [
        { id: 'a', entidad_id: 1, estado: 'error', ultimo_error: 'x', created_at: '2026-02' },
        { id: 'b', entidad_id: 1, estado: 'ok', ultimo_error: null, created_at: '2026-01' },
        { id: 'c', entidad_id: 2, estado: 'pendiente', ultimo_error: null, created_at: '2026-01' },
      ],
    })
    const sb = fakeSupabase({ sincronizaciones_acceso: q }) as never
    const m = await estadoDeEntidades(sb, 4, 'tarjeta', [1, 2])
    expect(m.get(1)).toEqual({ estado: 'error', error: 'x', tareaId: 'a' })
    expect(m.get(2)).toEqual({ estado: 'pendiente', error: null, tareaId: 'c' })
    expect(callsOf(q, 'eq').map((c) => c.args)).toEqual([['entidad', 'tarjeta'], ['fraccionamiento_id', 4]])
    expect(callsOf(q, 'in')[0].args).toEqual(['entidad_id', [1, 2]])
    expect(callsOf(q, 'order')[0].args).toEqual(['created_at', { ascending: false }])
  })

  test('sin ids no consulta', async () => {
    const sb = fakeSupabase({}) as never
    expect((await estadoDeEntidades(sb, null, 'control', [])).size).toBe(0)
  })

  test('sin fraccionamiento no filtra por él', async () => {
    const q = fakeQuery({ data: [] })
    await estadoDeEntidades(fakeSupabase({ sincronizaciones_acceso: q }) as never, null, 'control', [1])
    expect(callsOf(q, 'eq').map((c) => c.args[0])).toEqual(['entidad'])
  })

  test('propaga el error', async () => {
    const sb = fakeSupabase({ sincronizaciones_acceso: fakeQuery({ error: { message: 'boom' } }) }) as never
    await expect(estadoDeEntidades(sb, 1, 'tarjeta', [1])).rejects.toThrow('boom')
  })
})

describe('estadoDomicilio', () => {
  test('última tarea del domicilio', async () => {
    const q = fakeQuery({
      data: [
        { id: 'd', entidad_id: null, estado: 'ok', ultimo_error: null, created_at: '2' },
        { id: 'e', entidad_id: null, estado: 'error', ultimo_error: 'old', created_at: '1' },
      ],
    })
    const r = await estadoDomicilio(fakeSupabase({ sincronizaciones_acceso: q }) as never, 1, 8)
    expect(r).toEqual({ estado: 'ok', error: null, tareaId: 'd' })
    expect(callsOf(q, 'eq').map((c) => c.args)).toEqual([['domicilio_id', 8], ['entidad', 'domicilio'], ['fraccionamiento_id', 1]])
  })

  test('modo consola excluye las tareas asignar (no revela el estado de pago)', async () => {
    const q = fakeQuery({ data: [] })
    await estadoDomicilio(fakeSupabase({ sincronizaciones_acceso: q }) as never, 1, 8, { consola: true })
    expect(callsOf(q, 'neq')[0].args).toEqual(['operacion', 'asignar'])
  })

  test('sin modo consola no excluye asignar', async () => {
    const q = fakeQuery({ data: [] })
    await estadoDomicilio(fakeSupabase({ sincronizaciones_acceso: q }) as never, 1, 8)
    expect(callsOf(q, 'neq')).toEqual([])
  })

  test('sin tareas devuelve null', async () => {
    const q = fakeQuery({ data: [] })
    expect(await estadoDomicilio(fakeSupabase({ sincronizaciones_acceso: q }) as never, null, 8)).toBeNull()
  })
})

describe('listTareasAbiertas', () => {
  test('trae las no ok y agrega la dirección con una segunda consulta', async () => {
    const tareas = fakeQuery({
      data: [
        { id: 'a', domicilio_id: 5, estado: 'error' },
        { id: 'b', domicilio_id: null, estado: 'pendiente' },
        { id: 'c', domicilio_id: 5, estado: 'pendiente' },
      ],
    })
    const doms = fakeQuery({ data: [{ id: 5, direccion: 'Calle 1' }] })
    const sb = fakeSupabase({ sincronizaciones_acceso: tareas, domicilios: doms }) as never
    const r = await listTareasAbiertas(sb, 1)
    expect(callsOf(tareas, 'neq')[0].args).toEqual(['estado', 'ok'])
    expect(callsOf(tareas, 'order')[0].args).toEqual(['created_at', { ascending: true }])
    expect(callsOf(doms, 'in')[0].args).toEqual(['id', [5]])
    expect(r.map((t) => [t.id, t.direccion])).toEqual([['a', 'Calle 1'], ['b', null], ['c', 'Calle 1']])
  })

  test('modo consola oculta ultimo_error de las tareas asignar', async () => {
    const tareas = fakeQuery({
      data: [
        { id: 'a', domicilio_id: null, operacion: 'asignar', estado: 'error', ultimo_error: 'moroso' },
        { id: 'b', domicilio_id: null, operacion: 'tarjeta_crear', estado: 'error', ultimo_error: 'x' },
      ],
    })
    const sb = fakeSupabase({ sincronizaciones_acceso: tareas }) as never
    const r = await listTareasAbiertas(sb, 1, { consola: true })
    expect(r.map((t) => t.ultimo_error)).toEqual([null, 'x'])
    const r2 = await listTareasAbiertas(fakeSupabase({ sincronizaciones_acceso: tareas }) as never, 1)
    expect(r2.map((t) => t.ultimo_error)).toEqual(['moroso', 'x'])
  })

  test('sin domicilios no hace la segunda consulta', async () => {
    const tareas = fakeQuery({ data: [{ id: 'b', domicilio_id: null }] })
    const r = await listTareasAbiertas(fakeSupabase({ sincronizaciones_acceso: tareas }) as never, null)
    expect(r[0].direccion).toBeNull()
  })
})

describe('resumenSincronizacion', () => {
  test('cuenta por estado y última ok', async () => {
    const q = [
      fakeQuery({ count: 3 }),
      fakeQuery({ count: 2 }),
      fakeQuery({ data: [{ updated_at: '2026-11-01T00:00:00Z' }] }),
    ]
    const sb = fakeSupabase({ sincronizaciones_acceso: q }) as never
    expect(await resumenSincronizacion(sb, 1)).toEqual({ pendientes: 3, errores: 2, ultimaOk: '2026-11-01T00:00:00Z' })
    expect(callsOf(q[0], 'eq')[0].args).toEqual(['estado', 'pendiente'])
    expect(callsOf(q[1], 'eq')[0].args).toEqual(['estado', 'error'])
    expect(callsOf(q[0], 'select')[0].args).toEqual(['id', { count: 'exact', head: true }])
    expect(callsOf(q[2], 'limit')[0].args).toEqual([1])
  })

  test('sin datos', async () => {
    const sb = fakeSupabase({ sincronizaciones_acceso: fakeQuery({ data: [] }) }) as never
    expect(await resumenSincronizacion(sb, null)).toEqual({ pendientes: 0, errores: 0, ultimaOk: null })
  })
})
