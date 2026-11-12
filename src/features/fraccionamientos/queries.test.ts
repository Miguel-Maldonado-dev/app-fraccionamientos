import { describe, expect, test } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { getFraccionamiento, listBotones, listFraccionamientos, listInstalacionesEnUso, listMedios } from './queries'

const sb = (q: ReturnType<typeof fakeQuery>) => fakeSupabase({ fraccionamientos: q }) as never
const SELECT = 'id, nombre, slug, activo, instalacion_id, instalacion_nombre, perfiles(count), domicilios(count)'
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('listFraccionamientos', () => {
  test('lee los fraccionamientos con sus conteos, ordenados por nombre', async () => {
    const q = fakeQuery({
      data: [
        { id: 2, nombre: 'Lago Amadeo', slug: 'lago-amadeo', activo: true, instalacion_id: UUID, instalacion_nombre: 'Norte', perfiles: [{ count: 4 }], domicilios: [{ count: 120 }] },
        { id: 5, nombre: 'Nuevo', slug: 'nuevo', activo: false, instalacion_id: null, instalacion_nombre: null, perfiles: [], domicilios: null },
      ],
    })
    const rows = await listFraccionamientos(sb(q))
    expect(callsOf(q, 'select')[0].args).toEqual([SELECT])
    expect(callsOf(q, 'order')[0].args[0]).toBe('nombre')
    expect(rows).toEqual([
      { id: 2, nombre: 'Lago Amadeo', slug: 'lago-amadeo', activo: true, instalacionId: UUID, instalacionNombre: 'Norte', usuarios: 4, domicilios: 120 },
      { id: 5, nombre: 'Nuevo', slug: 'nuevo', activo: false, instalacionId: null, instalacionNombre: null, usuarios: 0, domicilios: 0 },
    ])
  })

  test('propaga el error de lectura', async () => {
    await expect(listFraccionamientos(sb(fakeQuery({ error: { message: 'boom' } })))).rejects.toThrow(
      'No se pudieron leer los fraccionamientos: boom',
    )
  })
})

describe('getFraccionamiento', () => {
  test('lee uno por id', async () => {
    const q = fakeQuery({
      data: { id: 2, nombre: 'Lago Amadeo', slug: 'lago-amadeo', activo: true, instalacion_id: null, instalacion_nombre: null, perfiles: [{ count: 1 }], domicilios: [{ count: 3 }] },
    })
    expect(await getFraccionamiento(sb(q), 2)).toEqual({
      id: 2,
      nombre: 'Lago Amadeo',
      slug: 'lago-amadeo',
      activo: true,
      instalacionId: null,
      instalacionNombre: null,
      usuarios: 1,
      domicilios: 3,
    })
    expect(callsOf(q, 'select')[0].args).toEqual([SELECT])
    expect(callsOf(q, 'eq')[0].args).toEqual(['id', 2])
    expect(callsOf(q, 'maybeSingle')).toHaveLength(1)
  })

  test('devuelve null si no existe', async () => {
    expect(await getFraccionamiento(sb(fakeQuery({ data: null })), 9)).toBeNull()
  })

  test('propaga el error de lectura', async () => {
    await expect(getFraccionamiento(sb(fakeQuery({ error: { message: 'boom' } })), 2)).rejects.toThrow(
      'No se pudo leer el fraccionamiento: boom',
    )
  })
})

describe('listMedios', () => {
  test('devuelve los medios habilitados del fraccionamiento', async () => {
    const q = fakeQuery({ data: [{ medio: 'tarjeta' }, { medio: 'pin' }] })
    const supabase = fakeSupabase({ fraccionamiento_medios: q }) as never
    expect(await listMedios(supabase, 3)).toEqual(['tarjeta', 'pin'])
    expect(callsOf(q, 'eq')[0].args).toEqual(['fraccionamiento_id', 3])
  })
  test('propaga el error', async () => {
    const supabase = fakeSupabase({ fraccionamiento_medios: fakeQuery({ error: { message: 'boom' } }) }) as never
    await expect(listMedios(supabase, 3)).rejects.toThrow('No se pudieron leer los medios: boom')
  })
})

describe('listBotones', () => {
  test('mapea las filas ordenadas por botón', async () => {
    const q = fakeQuery({
      data: [{ boton: 0, panel_id: UUID, panel_codigo: 'P1', salida: 2, salida_alias: 'Portón' }],
    })
    const supabase = fakeSupabase({ fraccionamiento_botones: q }) as never
    expect(await listBotones(supabase, 3)).toEqual([
      { boton: 0, panelId: UUID, panelCodigo: 'P1', salida: 2, salidaAlias: 'Portón' },
    ])
    expect(callsOf(q, 'order')[0].args[0]).toBe('boton')
  })
})

describe('listInstalacionesEnUso', () => {
  test('devuelve los ids de instalación vinculados', async () => {
    const q = fakeQuery({ data: [{ instalacion_id: UUID }] })
    const supabase = fakeSupabase({ fraccionamientos: q }) as never
    expect(await listInstalacionesEnUso(supabase)).toEqual([UUID])
    expect(callsOf(q, 'not')[0].args).toEqual(['instalacion_id', 'is', null])
  })
})
