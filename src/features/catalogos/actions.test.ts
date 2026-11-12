import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import {
  guardarCatalogo,
  guardarTipoCuota,
} from './actions'
import { encolar, instalacionDe, recalcularPermisos } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { MSG_NO_ENCONTRADO, MSG_NOMBRE_DUPLICADO } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn(), instalacionDe: vi.fn(), recalcularPermisos: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getCurrentUser: vi.fn(),
}))

const admin = { id: 'u1', email: 'a@b.c', userName: 'Ana', roleName: 'administrador', isActive: true }
const usar = (tables: Parameters<typeof fakeSupabase>[0]) => {
  const sb = fakeSupabase(tables)
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return sb
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(instalacionDe).mockResolvedValue(null)
  vi.mocked(recalcularPermisos).mockResolvedValue(0)
  vi.mocked(encolar).mockResolvedValue(undefined)
  vi.mocked(getCurrentUser).mockResolvedValue(admin as never)
})

describe('guardarCatalogo', () => {
  test('rechaza a quien no es administrador', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...admin, roleName: 'tesorero' } as never)
    const sb = usar({})
    const r = await guardarCatalogo('descuentos', null, { nombre: 'X', importe: '1' })
    expect(r).toEqual({ ok: false, error: 'No tienes permiso para realizar esta acción.' })
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('datos inválidos no escriben', async () => {
    const sb = usar({})
    const r = await guardarCatalogo('descuentos', null, { nombre: 'X', importe: '0' })
    expect(r).toEqual({ ok: false, error: 'El importe debe ser mayor a 0' })
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('crea un descuento y revalida las pantallas que lo usan', async () => {
    const dup = fakeQuery({ data: [{ id: 1, nombre: 'Pago Anticipado' }] })
    const insert = fakeQuery()
    usar({ conceptos_descuento: [dup, insert] })
    const r = await guardarCatalogo('descuentos', null, { nombre: ' Comité ', importe: '250' })
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(dup, 'select')[0].args).toEqual(['id, nombre'])
    expect(callsOf(insert, 'insert')[0].args).toEqual([{ nombre: 'Comité', monto_descuento: 250 }])
    expect(revalidatePath).toHaveBeenCalledWith('/configuracion')
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios', 'layout')
    expect(revalidatePath).toHaveBeenCalledWith('/cuotas')
    expect(revalidatePath).toHaveBeenCalledWith('/pagos')
  })

  test('rechaza un nombre repetido sin distinguir mayúsculas ni espacios guardados', async () => {
    const insert = fakeQuery()
    usar({ conceptos_descuento: [fakeQuery({ data: [{ id: 9, nombre: 'Comité ' }] }), insert] })
    const r = await guardarCatalogo('descuentos', null, { nombre: 'comité', importe: '250' })
    expect(r).toEqual({ ok: false, error: MSG_NOMBRE_DUPLICADO })
    expect(insert.calls).toHaveLength(0)
  })

  test('los comodines no provocan falsos duplicados', async () => {
    const insert = fakeQuery()
    usar({ conceptos_recargo: [fakeQuery({ data: [{ id: 1, nombre: 'Cuota Especial' }, { id: 2, nombre: '50 pesos' }] }), insert] })
    expect((await guardarCatalogo('recargos', null, { nombre: 'Cuota*', importe: '1' })).ok).toBe(true)
    usar({ conceptos_recargo: [fakeQuery({ data: [{ id: 2, nombre: '50 pesos' }] }), fakeQuery()] })
    expect((await guardarCatalogo('recargos', null, { nombre: '50%_', importe: '1' })).ok).toBe(true)
  })

  test('al editar no se cuenta a sí mismo como duplicado y actualiza por id', async () => {
    const dup = fakeQuery({ data: [{ id: 4, nombre: 'pago tardío' }] })
    const update = fakeQuery({ data: [{ id: 4 }] })
    usar({ conceptos_recargo: [dup, update] })
    const r = await guardarCatalogo('recargos', 4, { nombre: 'Pago tardío', importe: '60' })
    expect(r.ok).toBe(true)
    expect(callsOf(update, 'update')[0].args).toEqual([{ nombre: 'Pago tardío', monto_recargo: 60 }])
    expect(callsOf(update, 'eq')[0].args).toEqual(['id', 4])
    expect(callsOf(update, 'select')[0].args).toEqual(['id'])
  })

  test('conceptos extra fijan y filtran tipo_pago_id 2', async () => {
    const dup = fakeQuery({ data: [] })
    const insert = fakeQuery()
    usar({ conceptos_pago: [dup, insert] })
    await guardarCatalogo('extras', null, { nombre: 'Tarjeta', importe: '100' })
    expect(callsOf(dup, 'eq')).toContainEqual({ method: 'eq', args: ['tipo_pago_id', 2] })
    expect(callsOf(insert, 'insert')[0].args).toEqual([{ nombre: 'Tarjeta', importe: 100, tipo_pago_id: 2 }])

    const update = fakeQuery({ data: [{ id: 3 }] })
    usar({ conceptos_pago: [fakeQuery({ data: [] }), update] })
    await guardarCatalogo('extras', 3, { nombre: 'Tarjeta', importe: '120' })
    expect(callsOf(update, 'eq')).toEqual([
      { method: 'eq', args: ['id', 3] },
      { method: 'eq', args: ['tipo_pago_id', 2] },
    ])
  })

  test('si el elemento ya no existe no reporta éxito', async () => {
    usar({ conceptos_descuento: [fakeQuery({ data: [] }), fakeQuery({ data: [] })] })
    const r = await guardarCatalogo('descuentos', 99, { nombre: 'X', importe: '1' })
    expect(r).toEqual({ ok: false, error: MSG_NO_ENCONTRADO })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('guardarTipoCuota', () => {
  const PERFIL = 'aaaaaaaa-0000-0000-0000-000000000001'
  const input = {
    nombre: 'Acceso Vehicular',
    importe: '180',
    medios: ['telefono' as const],
    perfilCorrienteId: PERFIL,
    perfilCorrienteNombre: 'Residentes',
    perfilMorosoId: '',
    perfilMorosoNombre: 'Ignorado sin id',
  }
  const columnas = {
    medios: ['telefono'],
    perfil_corriente_id: PERFIL,
    perfil_corriente_nombre: 'Residentes',
    perfil_moroso_id: null,
    perfil_moroso_nombre: null,
  }

  const ACTUAL = { medios: ['telefono'], perfil_corriente_id: PERFIL, perfil_moroso_id: null }

  test('crea el concepto recurrente y su fila de accesos', async () => {
    const dup = fakeQuery({ data: [] })
    const insert = fakeQuery({ data: { id: 5 } })
    const acceso = fakeQuery()
    usar({ conceptos_pago: [dup, insert], concepto_pago_acceso: acceso })
    const r = await guardarTipoCuota(null, input)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(dup, 'eq')).toContainEqual({ method: 'eq', args: ['tipo_pago_id', 1] })
    expect(callsOf(insert, 'insert')[0].args).toEqual([{ nombre: 'Acceso Vehicular', importe: 180, tipo_pago_id: 1 }])
    expect(callsOf(acceso, 'insert')[0].args).toEqual([{ concepto_pago_id: 5, ...columnas }])
  })

  test('si falla la fila de accesos borra el concepto creado', async () => {
    const borrar = fakeQuery()
    usar({
      conceptos_pago: [fakeQuery({ data: [] }), fakeQuery({ data: { id: 5 } }), borrar],
      concepto_pago_acceso: fakeQuery({ error: { message: 'boom' } }),
    })
    const r = await guardarTipoCuota(null, input)
    expect(r).toEqual({ ok: false, error: 'Ocurrió un error inesperado. Intenta de nuevo.' })
    expect(callsOf(borrar, 'delete')).toHaveLength(1)
    expect(callsOf(borrar, 'eq')[0].args).toEqual(['id', 5])
  })

  test('al editar actualiza la fila de accesos por concepto, sin buscarla para insertar', async () => {
    const update = fakeQuery({ data: [{ id: 1 }] })
    const actualizar = fakeQuery({ data: [{ id: 7 }] })
    usar({ conceptos_pago: [fakeQuery({ data: [] }), update], concepto_pago_acceso: actualizar })
    const r = await guardarTipoCuota(1, input)
    expect(r.ok).toBe(true)
    expect(callsOf(update, 'eq')).toEqual([
      { method: 'eq', args: ['id', 1] },
      { method: 'eq', args: ['tipo_pago_id', 1] },
    ])
    expect(callsOf(actualizar, 'update')[0].args).toEqual([columnas])
    expect(callsOf(actualizar, 'eq')[0].args).toEqual(['concepto_pago_id', 1])
    expect(callsOf(actualizar, 'maybeSingle')).toHaveLength(0)
    expect(callsOf(actualizar, 'insert')).toHaveLength(0)
  })

  test('al editar sin fila de accesos la crea', async () => {
    const crear = fakeQuery()
    usar({
      conceptos_pago: [fakeQuery({ data: [] }), fakeQuery({ data: [{ id: 2 }] })],
      concepto_pago_acceso: [fakeQuery({ data: [] }), crear],
    })
    await guardarTipoCuota(2, input)
    expect(callsOf(crear, 'insert')[0].args).toEqual([{ concepto_pago_id: 2, ...columnas }])
  })

  test('si fallan los accesos al editar, refresca las pantallas porque nombre e importe ya se guardaron', async () => {
    usar({
      conceptos_pago: [fakeQuery({ data: [] }), fakeQuery({ data: [{ id: 2 }] })],
      concepto_pago_acceso: fakeQuery({ error: { message: 'boom' } }),
    })
    const r = await guardarTipoCuota(2, input)
    expect(r.ok).toBe(false)
    expect(revalidatePath).toHaveBeenCalledWith('/configuracion')
  })
  describe('sincronización con access-core', () => {
    const FID = 3
    const conInstalacion = (hay: boolean) =>
      vi.mocked(instalacionDe).mockResolvedValue(hay ? { fid: FID, instalacionId: 'i-1' } : null)
    const reconciliar = (domicilioId: number) => ({
      fraccionamientoId: FID,
      domicilioId,
      entidad: 'domicilio',
      entidadId: null,
      operacion: 'reconciliar',
    })
    function preparar(actual: unknown, extra: Partial<{ escritura: ReturnType<typeof fakeQuery> }> = {}) {
      conInstalacion(true)
      const dc = fakeQuery({ data: [{ domicilio_id: 10 }, { domicilio_id: 11 }] })
      const sb = usar({
        conceptos_pago: [fakeQuery({ data: [] }), extra.escritura ?? fakeQuery({ data: [{ id: 1 }] })],
        concepto_pago_acceso: [fakeQuery({ data: actual }), fakeQuery({ data: [{ id: 7 }] })],
        domicilio_concepto: dc,
      })
      return { dc, sb }
    }

    test('si cambian los medios encola reconciliar por cada domicilio del tipo', async () => {
      const { dc } = preparar({ ...ACTUAL, medios: ['tarjeta'] })
      const r = await guardarTipoCuota(1, input)
      expect(r.ok).toBe(true)
      expect(callsOf(dc, 'eq')[0].args).toEqual(['concepto_id', 1])
      expect(encolar).toHaveBeenCalledWith(expect.anything(), [reconciliar(10), reconciliar(11)])
    })

    test('sin cambios de medios no encola, pero recalcula y dispara (es idempotente)', async () => {
      preparar(ACTUAL)
      const r = await guardarTipoCuota(1, input)
      expect(r.ok).toBe(true)
      expect(encolar).not.toHaveBeenCalled()
      expect(recalcularPermisos).toHaveBeenCalledWith(expect.anything(), FID)
      expect(dispararSincronizacion).toHaveBeenCalledWith(FID)
    })

    test('sin instalación no encola, no recalcula ni dispara', async () => {
      preparar({ ...ACTUAL, medios: ['tarjeta'], perfil_corriente_id: 'otro' })
      conInstalacion(false)
      const r = await guardarTipoCuota(1, input)
      expect(r.ok).toBe(true)
      expect(instalacionDe).toHaveBeenCalled()
      expect(encolar).not.toHaveBeenCalled()
      expect(recalcularPermisos).not.toHaveBeenCalled()
      expect(dispararSincronizacion).not.toHaveBeenCalled()
    })

    test('un tipo nuevo no consulta ni encola nada', async () => {
      conInstalacion(true)
      usar({
        conceptos_pago: [fakeQuery({ data: [] }), fakeQuery({ data: { id: 5 } })],
        concepto_pago_acceso: fakeQuery(),
      })
      await guardarTipoCuota(null, input)
      expect(encolar).not.toHaveBeenCalled()
      expect(recalcularPermisos).not.toHaveBeenCalled()
      expect(dispararSincronizacion).not.toHaveBeenCalled()
    })

    test('si falla la escritura tras encolar, devuelve el error y el reintento vuelve a encolar', async () => {
      preparar({ ...ACTUAL, medios: ['tarjeta'] }, { escritura: fakeQuery({ error: { message: 'boom' } }) })
      const r1 = await guardarTipoCuota(1, input)
      expect(r1.ok).toBe(false)
      expect(encolar).toHaveBeenCalledTimes(1)
      expect(recalcularPermisos).not.toHaveBeenCalled()
      // La fila de accesos sigue con los medios viejos: el reintento ve el mismo cambio.
      preparar({ ...ACTUAL, medios: ['tarjeta'] })
      const r2 = await guardarTipoCuota(1, input)
      expect(r2.ok).toBe(true)
      expect(encolar).toHaveBeenCalledTimes(2)
    })

    test('si recalcular falla tras escribir, devuelve el error y un reintento sin cambios recalcula otra vez', async () => {
      preparar({ ...ACTUAL, perfil_corriente_id: 'otro' })
      vi.mocked(recalcularPermisos).mockRejectedValueOnce(new Error('rpc'))
      const r1 = await guardarTipoCuota(1, input)
      expect(r1).toEqual({ ok: false, error: 'Ocurrió un error inesperado. Intenta de nuevo.' })
      expect(dispararSincronizacion).not.toHaveBeenCalled()
      preparar(ACTUAL) // la fila ya quedó guardada: sin cambios
      const r2 = await guardarTipoCuota(1, input)
      expect(r2.ok).toBe(true)
      expect(recalcularPermisos).toHaveBeenCalledTimes(2)
      expect(dispararSincronizacion).toHaveBeenCalledWith(FID)
    })

    test('medios y permiso juntos: encola, escribe, recalcula y dispara en ese orden', async () => {
      const { sb } = preparar({ ...ACTUAL, medios: [], perfil_corriente_id: 'otro' })
      const orden: string[] = []
      vi.mocked(encolar).mockImplementation(async () => void orden.push('encolar'))
      vi.mocked(recalcularPermisos).mockImplementation(async () => (orden.push('recalcular'), 0))
      vi.mocked(dispararSincronizacion).mockImplementation(() => void orden.push('disparar'))
      const original = sb.from.getMockImplementation()!
      sb.from.mockImplementation((t: string) => {
        if (t === 'conceptos_pago' && orden.at(-1) === 'encolar') orden.push('escribir')
        return original(t)
      })
      await guardarTipoCuota(1, input)
      expect(orden).toEqual(['encolar', 'escribir', 'recalcular', 'disparar'])
    })
  })
})
