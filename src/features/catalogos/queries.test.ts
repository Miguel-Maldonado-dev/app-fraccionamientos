import { describe, expect, test } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { listConceptosDescuento, listConceptosRecargo } from '@/features/cuotas/queries'
import { listConceptosExtraCatalogo, listMediosHabilitados, listTiposCuota } from './queries'

const sb = (q: ReturnType<typeof fakeQuery>) => fakeSupabase({ conceptos_pago: q }) as never

const SIN_PERFILES = {
  perfil_corriente_id: null,
  perfil_corriente_nombre: null,
  perfil_moroso_id: null,
  perfil_moroso_nombre: null,
}
const PERFILES_NULOS = {
  perfilCorrienteId: null,
  perfilCorrienteNombre: null,
  perfilMorosoId: null,
  perfilMorosoNombre: null,
}

describe('listTiposCuota', () => {
  test('lee los conceptos recurrentes con sus medios y permisos, ordenados por nombre; sin fila, sin medios', async () => {
    const q = fakeQuery({
      data: [
        { id: 2, nombre: 'Acceso Peatonal', importe: 100, concepto_pago_acceso: [{ ...SIN_PERFILES, medios: ['tarjeta'] }] },
        { id: 9, nombre: 'Nuevo', importe: 50, concepto_pago_acceso: [] },
        {
          id: 1,
          nombre: 'Acceso Completo',
          importe: 250,
          concepto_pago_acceso: {
            medios: ['tarjeta', 'telefono'],
            perfil_corriente_id: 'p1',
            perfil_corriente_nombre: 'Residentes',
            perfil_moroso_id: 'p2',
            perfil_moroso_nombre: 'Morosos',
          },
        },
      ],
    })
    const rows = await listTiposCuota(sb(q))
    expect(callsOf(q, 'select')[0].args).toEqual([
      'id, nombre, importe, concepto_pago_acceso(medios, perfil_corriente_id, perfil_corriente_nombre, perfil_moroso_id, perfil_moroso_nombre)',
    ])
    expect(callsOf(q, 'eq')[0].args).toEqual(['tipo_pago_id', 1])
    expect(callsOf(q, 'order')[0].args[0]).toBe('nombre')
    expect(rows).toEqual([
      { id: 2, nombre: 'Acceso Peatonal', importe: 100, medios: ['tarjeta'], ...PERFILES_NULOS },
      { id: 9, nombre: 'Nuevo', importe: 50, medios: [], ...PERFILES_NULOS },
      {
        id: 1,
        nombre: 'Acceso Completo',
        importe: 250,
        medios: ['tarjeta', 'telefono'],
        perfilCorrienteId: 'p1',
        perfilCorrienteNombre: 'Residentes',
        perfilMorosoId: 'p2',
        perfilMorosoNombre: 'Morosos',
      },
    ])
  })

  test('propaga el error de lectura', async () => {
    await expect(listTiposCuota(sb(fakeQuery({ error: { message: 'boom' } })))).rejects.toThrow(
      'No se pudieron leer los tipos de cuota: boom',
    )
  })
})

describe('listConceptosExtraCatalogo', () => {
  test('lee los conceptos extra ordenados por nombre', async () => {
    const q = fakeQuery({ data: [{ id: 3, nombre: 'Tarjeta de Acceso', importe: 100 }] })
    expect(await listConceptosExtraCatalogo(sb(q))).toEqual([{ id: 3, nombre: 'Tarjeta de Acceso', importe: 100 }])
    expect(callsOf(q, 'eq')[0].args).toEqual(['tipo_pago_id', 2])
    expect(callsOf(q, 'order')[0].args[0]).toBe('nombre')
  })

  test('propaga el error de lectura', async () => {
    await expect(listConceptosExtraCatalogo(sb(fakeQuery({ error: { message: 'x' } })))).rejects.toThrow(
      'No se pudieron leer los conceptos extra: x',
    )
  })
})

describe('filtro por fraccionamiento (consola)', () => {
  test('sin id no filtra por fraccionamiento', async () => {
    const tipos = fakeQuery({ data: [] })
    await listTiposCuota(sb(tipos))
    const extras = fakeQuery({ data: [] })
    await listConceptosExtraCatalogo(sb(extras))
    const descuentos = fakeQuery({ data: [] })
    await listConceptosDescuento(fakeSupabase({ conceptos_descuento: descuentos }) as never)
    const recargos = fakeQuery({ data: [] })
    await listConceptosRecargo(fakeSupabase({ conceptos_recargo: recargos }) as never)
    for (const q of [tipos, extras, descuentos, recargos]) {
      expect(callsOf(q, 'eq').map((c) => c.args[0])).not.toContain('fraccionamiento_id')
    }
  })

  test('con id filtra las cuatro consultas', async () => {
    const tipos = fakeQuery({ data: [] })
    await listTiposCuota(sb(tipos), 7)
    const extras = fakeQuery({ data: [] })
    await listConceptosExtraCatalogo(sb(extras), 7)
    const descuentos = fakeQuery({ data: [] })
    await listConceptosDescuento(fakeSupabase({ conceptos_descuento: descuentos }) as never, 7)
    const recargos = fakeQuery({ data: [] })
    await listConceptosRecargo(fakeSupabase({ conceptos_recargo: recargos }) as never, 7)
    for (const q of [tipos, extras, descuentos, recargos]) {
      expect(callsOf(q, 'eq')).toContainEqual({ method: 'eq', args: ['fraccionamiento_id', 7] })
    }
  })
})

describe('listMediosHabilitados', () => {
  test('devuelve los medios habilitados en el orden del catálogo, sin los no habilitables', async () => {
    const q = fakeQuery({ data: [{ medio: 'telefono' }, { medio: 'qr' }, { medio: 'tarjeta' }] })
    const supabase = fakeSupabase({ fraccionamiento_medios: q }) as never
    expect(await listMediosHabilitados(supabase, 4)).toEqual(['tarjeta', 'telefono'])
    expect(callsOf(q, 'eq')[0].args).toEqual(['fraccionamiento_id', 4])
  })

  test('sin id no filtra por fraccionamiento', async () => {
    const q = fakeQuery({ data: [] })
    expect(await listMediosHabilitados(fakeSupabase({ fraccionamiento_medios: q }) as never)).toEqual([])
    expect(callsOf(q, 'eq')).toHaveLength(0)
  })
})
