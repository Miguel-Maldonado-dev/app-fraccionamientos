import { describe, expect, test } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { sincronizarTelefonoAcceso } from './telefono-acceso'

const base = { residenteId: 5, domicilioId: 9, fraccionamientoId: 1, telefonoAnterior: null, telefonoNuevo: '3312345678' }

function cliente(medios: string[] | null, existente: unknown[] = []) {
  const ta = [fakeQuery({ data: existente }), fakeQuery({})]
  const s = fakeSupabase({
    domicilio_concepto: fakeQuery({ data: { concepto_id: 3 } }),
    concepto_pago_acceso: fakeQuery({ data: medios ? { medios } : null }),
    telefonos_acceso: ta,
  })
  return { s: s as never, ta }
}

describe('sincronizarTelefonoAcceso', () => {
  test('con el medio habilitado inserta el teléfono', async () => {
    const { s, ta } = cliente(['telefono', 'tarjeta'])
    await sincronizarTelefonoAcceso(s, base)
    expect(callsOf(ta[1], 'insert')[0].args).toEqual([
      { domicilio_id: 9, telefono: '3312345678', fraccionamiento_id: 1, residente_id: 5 },
    ])
  })

  test('es idempotente: si ya está registrado no lo duplica', async () => {
    const { s, ta } = cliente(['telefono'], [{ id: 1 }])
    await sincronizarTelefonoAcceso(s, base)
    expect(callsOf(ta[1], 'insert')).toHaveLength(0)
  })

  test('sin el medio habilitado no hace nada', async () => {
    const { s, ta } = cliente(['tarjeta'])
    await sincronizarTelefonoAcceso(s, base)
    expect(callsOf(ta[0], 'select')).toHaveLength(0)
    expect(callsOf(ta[1], 'insert')).toHaveLength(0)
  })

  test('sin configuración de acceso no hace nada', async () => {
    const { s, ta } = cliente(null)
    await sincronizarTelefonoAcceso(s, base)
    expect(callsOf(ta[1], 'insert')).toHaveLength(0)
  })

  test('al quitar el acceso borra el teléfono anterior', async () => {
    const { s, ta } = cliente(['telefono'])
    await sincronizarTelefonoAcceso(s, { ...base, telefonoAnterior: '3300000000', telefonoNuevo: null })
    expect(callsOf(ta[0], 'delete')).toHaveLength(1)
    expect(callsOf(ta[0], 'eq').map((c) => c.args)).toEqual([['domicilio_id', 9], ['telefono', '3300000000'], ['residente_id', 5]])
  })

  test('teléfono registrado a mano: no se reclama y el borrado se limita al residente', async () => {
    const { s, ta } = cliente(['telefono'], [{ id: 1 }])
    await sincronizarTelefonoAcceso(s, { ...base, telefonoAnterior: '3300000000', telefonoNuevo: null })
    // El borrado solo alcanza filas marcadas con este residente (la manual tiene residente_id null).
    expect(callsOf(ta[0], 'eq').map((c) => c.args)).toContainEqual(['residente_id', 5])
    expect(callsOf(ta[1], 'insert')).toHaveLength(0)
  })

  test('al cambiar de teléfono borra el anterior e inserta el nuevo', async () => {
    const { s, ta } = cliente(['telefono'])
    await sincronizarTelefonoAcceso(s, { ...base, telefonoAnterior: '3300000000' })
    expect(callsOf(ta[0], 'delete')).toHaveLength(1)
    expect(callsOf(ta[1], 'insert')).toHaveLength(1)
  })
})
