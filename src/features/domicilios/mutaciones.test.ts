import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { encolar, instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { actualizarDomicilioEn, crearDomicilioEn } from './mutaciones'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn(), instalacionDe: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))

const INST = { fid: 7, instalacionId: 'inst-1' }
const input = { direccion: 'lago 1', fechaAlta: '2026-01-01', observaciones: 'Portón' }

function usar(tables: Record<string, FakeQuery | FakeQuery[]>) {
  const sb = fakeSupabase(tables)
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return sb
}

const tareas = () => vi.mocked(encolar).mock.calls.flatMap(([, t]) => t)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(instalacionDe).mockResolvedValue(INST)
  vi.mocked(encolar).mockResolvedValue(undefined)
})

describe('crearDomicilioEn', () => {
  test('encola domicilio crear y luego asignar, después de insertar, y dispara', async () => {
    const insert = fakeQuery({ data: { id: 40 } })
    const concepto = fakeQuery()
    usar({ domicilios_info: fakeQuery({ data: [] }), domicilios: insert, domicilio_concepto: concepto })

    const r = await crearDomicilioEn(null, 'u1', { ...input, conceptoId: '2' })

    expect(r).toEqual({ ok: true, data: { id: 40 } })
    expect(instalacionDe).toHaveBeenCalledWith(expect.anything(), null)
    expect(tareas()).toEqual([
      {
        fraccionamientoId: 7,
        domicilioId: 40,
        entidad: 'domicilio',
        entidadId: 40,
        operacion: 'crear',
        carga: { kind: 'domicilio', name: 'LAGO 1', address: 'LAGO 1', notes: 'Portón' },
      },
      { fraccionamientoId: 7, domicilioId: 40, entidad: 'domicilio', entidadId: null, operacion: 'asignar' },
    ])
    // El domicilio y su tipo de cuota existen antes de encolar.
    const encolarAt = vi.mocked(encolar).mock.invocationCallOrder[0]
    expect(vi.mocked(createClient).mock.invocationCallOrder[0]).toBeLessThan(encolarAt)
    expect(callsOf(concepto, 'insert')).toHaveLength(1)
    expect(dispararSincronizacion).toHaveBeenCalledWith(7)
  })

  test('sin instalación no encola ni dispara', async () => {
    vi.mocked(instalacionDe).mockResolvedValue(null)
    usar({ domicilios_info: fakeQuery({ data: [] }), domicilios: fakeQuery({ data: { id: 40 } }) })

    const r = await crearDomicilioEn(null, 'u1', input)

    expect(r.ok).toBe(true)
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('la consola encola con su fraccionamiento explícito', async () => {
    usar({ domicilios: [fakeQuery({ data: [] }), fakeQuery({ data: { id: 41 } })] })
    await crearDomicilioEn(7, 'u0', input)
    expect(instalacionDe).toHaveBeenCalledWith(expect.anything(), 7)
    expect(tareas().map((t) => t.operacion)).toEqual(['crear', 'asignar'])
  })
})

describe('actualizarDomicilioEn', () => {
  const actual = { direccion: 'LAGO 1', observaciones: 'Portón' }

  test('cambiar el tipo de cuota encola reconciliar y asignar antes de escribir', async () => {
    const lectura = fakeQuery({ data: actual })
    const update = fakeQuery()
    const concepto = fakeQuery({ data: { id: 9, domicilio_id: 5, concepto_id: 1 } })
    usar({ domicilios: [lectura, update], domicilio_concepto: concepto })

    const r = await actualizarDomicilioEn(null, 5, { ...input, conceptoId: 3 })

    expect(r).toEqual({ ok: true, data: undefined })
    expect(tareas()).toEqual([
      { fraccionamientoId: 7, domicilioId: 5, entidad: 'domicilio', entidadId: null, operacion: 'reconciliar' },
      { fraccionamientoId: 7, domicilioId: 5, entidad: 'domicilio', entidadId: null, operacion: 'asignar' },
    ])
    expect(callsOf(concepto, 'update')[0].args).toEqual([{ concepto_id: 3 }])
    expect(dispararSincronizacion).toHaveBeenCalledWith(7)
  })

  test('cambiar dirección u observaciones encola domicilio actualizar con los datos nuevos', async () => {
    usar({
      domicilios: [fakeQuery({ data: actual }), fakeQuery()],
      domicilio_concepto: fakeQuery({ data: { id: 9, domicilio_id: 5, concepto_id: 3 } }),
    })

    await actualizarDomicilioEn(null, 5, { ...input, direccion: 'lago 2', observaciones: '', conceptoId: 3 })

    expect(tareas()).toEqual([
      {
        fraccionamientoId: 7,
        domicilioId: 5,
        entidad: 'domicilio',
        entidadId: 5,
        operacion: 'actualizar',
        carga: { kind: 'domicilio', name: 'LAGO 2', address: 'LAGO 2', notes: '' },
      },
    ])
  })

  test('sin cambios sincronizables (solo fecha) no encola', async () => {
    usar({
      domicilios: [fakeQuery({ data: actual }), fakeQuery()],
      domicilio_concepto: fakeQuery({ data: { id: 9, domicilio_id: 5, concepto_id: 3 } }),
    })
    await actualizarDomicilioEn(null, 5, { ...input, fechaAlta: '2026-02-01', conceptoId: 3 })
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('encola antes del update: si el update falla, la tarea ya está en la cola', async () => {
    const update = fakeQuery({ error: { message: 'caída' } })
    usar({ domicilios: [fakeQuery({ data: actual }), update], domicilio_concepto: fakeQuery({ data: null }) })

    await expect(actualizarDomicilioEn(null, 5, { ...input, direccion: 'lago 2' })).rejects.toThrow('caída')

    expect(tareas().map((t) => t.operacion)).toEqual(['actualizar'])
  })

  test('la consola nunca encola reconciliar (no cambia el tipo de cuota)', async () => {
    usar({ domicilios: [fakeQuery({ data: actual }), fakeQuery({ data: [{ id: 5 }] })] })
    await actualizarDomicilioEn(7, 5, { ...input, direccion: 'lago 2', conceptoId: 3 })
    expect(instalacionDe).toHaveBeenCalledWith(expect.anything(), 7)
    expect(tareas().map((t) => t.operacion)).toEqual(['actualizar'])
  })

  test('sin instalación no encola', async () => {
    vi.mocked(instalacionDe).mockResolvedValue(null)
    usar({
      domicilios: [fakeQuery({ data: actual }), fakeQuery()],
      domicilio_concepto: fakeQuery({ data: { id: 9, domicilio_id: 5, concepto_id: 1 } }),
    })
    const r = await actualizarDomicilioEn(null, 5, { ...input, direccion: 'lago 2', conceptoId: 3 })
    expect(r.ok).toBe(true)
    expect(encolar).not.toHaveBeenCalled()
  })
})
