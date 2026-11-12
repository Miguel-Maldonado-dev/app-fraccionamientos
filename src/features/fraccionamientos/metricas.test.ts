import { describe, expect, test } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { listMetricasFraccionamientos, totalesPlataforma, type MetricasFraccionamiento } from './metricas'

const SELECT =
  'id, nombre, activo, domicilios(count), residentes(count), tarjetas_acceso(count), telefonos_acceso(count), usuarios_activos:perfiles(count)'

describe('listMetricasFraccionamientos', () => {
  test('una sola consulta con conteos embebidos, perfiles activos y orden por nombre', async () => {
    const q = fakeQuery({
      data: [
        {
          id: 1,
          nombre: 'Lago',
          activo: true,
          domicilios: [{ count: 10 }],
          residentes: [{ count: 20 }],
          tarjetas_acceso: [{ count: 5 }],
          telefonos_acceso: [{ count: 7 }],
          usuarios_activos: [{ count: 2 }],
        },
        { id: 2, nombre: 'Nuevo', activo: false, domicilios: [], residentes: null, tarjetas_acceso: [], telefonos_acceso: [], usuarios_activos: [] },
      ],
    })
    const sb = fakeSupabase({ fraccionamientos: q }) as never
    const rows = await listMetricasFraccionamientos(sb)
    expect(callsOf(q, 'select')[0].args).toEqual([SELECT])
    expect(callsOf(q, 'eq')[0].args).toEqual(['usuarios_activos.activo', true])
    expect(callsOf(q, 'order')[0].args[0]).toBe('nombre')
    expect(rows).toEqual([
      { id: 1, nombre: 'Lago', activo: true, domicilios: 10, residentes: 20, usuariosActivos: 2, tarjetas: 5, telefonos: 7 },
      { id: 2, nombre: 'Nuevo', activo: false, domicilios: 0, residentes: 0, usuariosActivos: 0, tarjetas: 0, telefonos: 0 },
    ])
  })

  test('propaga el error', async () => {
    const sb = fakeSupabase({ fraccionamientos: fakeQuery({ error: { message: 'boom' } }) }) as never
    await expect(listMetricasFraccionamientos(sb)).rejects.toThrow('No se pudieron leer las métricas: boom')
  })
})

describe('totalesPlataforma', () => {
  test('suma y cuenta activos', () => {
    const rows: MetricasFraccionamiento[] = [
      { id: 1, nombre: 'A', activo: true, domicilios: 1, residentes: 2, usuariosActivos: 3, tarjetas: 4, telefonos: 5 },
      { id: 2, nombre: 'B', activo: false, domicilios: 10, residentes: 20, usuariosActivos: 30, tarjetas: 40, telefonos: 50 },
    ]
    expect(totalesPlataforma(rows)).toEqual({
      fraccionamientos: 2, activos: 1, domicilios: 11, residentes: 22, usuariosActivos: 33, tarjetas: 44, telefonos: 55,
    })
    expect(totalesPlataforma([]).fraccionamientos).toBe(0)
  })
})
