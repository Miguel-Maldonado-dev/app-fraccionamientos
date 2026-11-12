import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { encolar, instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { MSG_ACCESO_NO_ENCONTRADO } from '@/features/accesos/messages'
import { actualizarControl, crearControl, eliminarControl } from './actions'
import { MSG_MAX_CONTROLES } from './messages'

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

const input = {
  descripcion: ' Auto rojo ',
  botones: [
    { boton: 0, rfCode: '123456' },
    { boton: 2, rfCode: '4294967295' },
  ],
}

describe('crearControl', () => {
  test('un tercer control → MSG_MAX_CONTROLES sin insertar ni encolar', async () => {
    const q = fakeQuery({ count: 2 })
    usar({ controles_acceso: q })
    expect(await crearControl(9, input)).toEqual({ ok: false, error: MSG_MAX_CONTROLES })
    expect(MSG_MAX_CONTROLES).toBe('Máximo 2 controles por domicilio')
    expect(callsOf(q, 'insert')).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('rechaza botones repetidos sin tocar la base', async () => {
    const r = await crearControl(9, {
      botones: [
        { boton: 1, rfCode: '1' },
        { boton: 1, rfCode: '2' },
      ],
    })
    expect(r).toEqual({ ok: false, error: 'Cada botón solo puede usarse una vez' })
    expect(createClient).not.toHaveBeenCalled()
  })

  test('inserta los botones (rf_code numérico) y encola control crear con el id nuevo', async () => {
    const conteo = fakeQuery({ count: 1 })
    const insert = fakeQuery({ data: { id: 41 } })
    usar({ controles_acceso: [conteo, insert] })
    const r = await crearControl(9, input)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(insert, 'insert')[0].args).toEqual([
      {
        domicilio_id: 9,
        descripcion: 'Auto rojo',
        botones: [
          { boton: 0, rf_code: 123456, boton_id: null },
          { boton: 2, rf_code: 4294967295, boton_id: null },
        ],
      },
    ])
    expect(tareas()).toEqual([
      { fraccionamientoId: 7, domicilioId: 9, entidad: 'control', entidadId: 41, operacion: 'crear' },
    ])
    expect(dispararSincronizacion).toHaveBeenCalledWith(7)
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
  })

  test('si no se puede encolar, borra el control recién creado', async () => {
    vi.mocked(encolar).mockRejectedValue(new Error('cola caída'))
    const borrar = fakeQuery()
    usar({ controles_acceso: [fakeQuery({ count: 0 }), fakeQuery({ data: { id: 41 } }), borrar] })
    expect((await crearControl(9, input)).ok).toBe(false)
    expect(callsOf(borrar, 'delete')).toHaveLength(1)
    expect(callsOf(borrar, 'eq')[0].args).toEqual(['id', 41])
  })

  test('sin instalación inserta sin encolar', async () => {
    vi.mocked(instalacionDe).mockResolvedValue(null)
    usar({ controles_acceso: [fakeQuery({ count: 0 }), fakeQuery({ data: { id: 41 } })] })
    expect((await crearControl(9, input)).ok).toBe(true)
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })
})

const configurados = (botones: number[]) => fakeQuery({ data: botones.map((boton) => ({ boton })) })

describe('actualizarControl', () => {
  const guardado = {
    id: 5,
    domicilio_id: 9,
    fraccionamiento_id: 7,
    control_id: 'ctl-1',
    botones: [
      { boton: 0, rf_code: 11, boton_id: 'b0' },
      { boton: 2, rf_code: 22, boton_id: 'b2' },
    ],
  }

  test('cambiar solo la descripción conserva el botón sin salida configurada (rf_code y boton_id)', async () => {
    const update = fakeQuery()
    const botones = configurados([0])
    usar({ controles_acceso: [fakeQuery({ data: guardado }), update], fraccionamiento_botones: botones })
    const r = await actualizarControl(5, 9, { descripcion: 'Nueva', botones: [{ boton: 0, rfCode: '11' }] })
    expect(r.ok).toBe(true)
    expect(callsOf(botones, 'eq')[0].args).toEqual(['fraccionamiento_id', 7])
    expect(callsOf(update, 'update')[0].args).toEqual([
      {
        descripcion: 'Nueva',
        botones: [
          { boton: 0, rf_code: 11, boton_id: 'b0' },
          { boton: 2, rf_code: 22, boton_id: 'b2' },
        ],
      },
    ])
  })

  test('cambiar el código del botón configurado conserva el botón sin salida', async () => {
    const update = fakeQuery()
    usar({ controles_acceso: [fakeQuery({ data: guardado }), update], fraccionamiento_botones: configurados([0]) })
    expect((await actualizarControl(5, 9, { botones: [{ boton: 0, rfCode: '99' }] })).ok).toBe(true)
    expect(callsOf(update, 'update')[0].args[0]).toEqual({
      descripcion: null,
      botones: [
        { boton: 0, rf_code: 99, boton_id: 'b0' },
        { boton: 2, rf_code: 22, boton_id: 'b2' },
      ],
    })
  })

  test('encola control actualizar ANTES de escribir y conserva el boton_id de los botones que siguen', async () => {
    const lectura = fakeQuery({
      data: {
        id: 5,
        domicilio_id: 9,
        control_id: 'ctl-1',
        botones: [
          { boton: 0, rf_code: 1, boton_id: 'b0' },
          { boton: 1, rf_code: 2, boton_id: 'b1' },
        ],
      },
    })
    const update = fakeQuery()
    usar({ controles_acceso: [lectura, update], fraccionamiento_botones: configurados([0, 1, 2, 3]) })
    let escritoAlEncolar = true
    vi.mocked(encolar).mockImplementation(async () => {
      escritoAlEncolar = callsOf(update, 'update').length > 0
    })

    const r = await actualizarControl(5, 9, { descripcion: '', botones: [{ boton: 0, rfCode: '99' }, { boton: 3, rfCode: '7' }] })

    expect(r.ok).toBe(true)
    expect(escritoAlEncolar).toBe(false)
    expect(tareas()).toEqual([
      { fraccionamientoId: 7, domicilioId: 9, entidad: 'control', entidadId: 5, operacion: 'actualizar' },
    ])
    expect(callsOf(update, 'update')[0].args).toEqual([
      {
        descripcion: null,
        botones: [
          { boton: 0, rf_code: 99, boton_id: 'b0' },
          { boton: 3, rf_code: 7, boton_id: null },
        ],
      },
    ])
    expect(callsOf(update, 'eq')[0].args).toEqual(['id', 5])
    expect(dispararSincronizacion).toHaveBeenCalledWith(7)
  })

  test('si el control ya no existe no encola', async () => {
    usar({ controles_acceso: fakeQuery({ data: null }) })
    expect(await actualizarControl(5, 9, input)).toEqual({ ok: false, error: MSG_ACCESO_NO_ENCONTRADO })
    expect(encolar).not.toHaveBeenCalled()
  })
})

describe('eliminarControl', () => {
  test('encola borrar con control_id ANTES de borrar la fila', async () => {
    const lectura = fakeQuery({ data: { id: 5, domicilio_id: 9, control_id: 'ctl-1', botones: [] } })
    const borrar = fakeQuery()
    usar({ controles_acceso: [lectura, borrar] })
    let filaBorradaAlEncolar = true
    vi.mocked(encolar).mockImplementation(async () => {
      filaBorradaAlEncolar = callsOf(borrar, 'delete').length > 0
    })

    expect((await eliminarControl(5, 9)).ok).toBe(true)
    expect(tareas()).toEqual([
      {
        fraccionamientoId: 7,
        domicilioId: 9,
        entidad: 'control',
        entidadId: 5,
        operacion: 'borrar',
        carga: { control_id: 'ctl-1' },
      },
    ])
    expect(filaBorradaAlEncolar).toBe(false)
    expect(callsOf(borrar, 'delete')).toHaveLength(1)
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
  })

  test('si no se puede encolar no borra la fila', async () => {
    vi.mocked(encolar).mockRejectedValue(new Error('cola caída'))
    const borrar = fakeQuery()
    usar({ controles_acceso: [fakeQuery({ data: { id: 5, domicilio_id: 9, control_id: null, botones: [] } }), borrar] })
    expect((await eliminarControl(5, 9)).ok).toBe(false)
    expect(callsOf(borrar, 'delete')).toHaveLength(0)
  })
})

describe('permisos', () => {
  test('un tesorero no puede escribir controles', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, roleName: 'tesorero' } as never)
    expect(await crearControl(9, input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await actualizarControl(1, 9, input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await eliminarControl(1, 9)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createClient).not.toHaveBeenCalled()
  })
})
