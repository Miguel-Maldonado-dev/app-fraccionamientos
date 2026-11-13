import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getTenantContext, type TenantContext } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { encolar, instalacionDe } from '@/features/sincronizacion/cola'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { MSG_ACCESO_NO_ENCONTRADO, MSG_MAX_TARJETAS, MSG_MAX_TELEFONOS } from '@/features/accesos/messages'
import { MSG_DOMICILIO_DUPLICADO, MSG_DOMICILIO_NO_ENCONTRADO } from '@/features/domicilios/messages'
import { MSG_MAX_CONTROLES } from '@/features/controles/messages'
import { fijarPin, generarPin } from '@/lib/access-core'
import {
  actualizarControlEnFraccionamiento,
  actualizarDomicilioEnFraccionamiento,
  actualizarResidenteEnFraccionamiento,
  actualizarTarjetaEnFraccionamiento,
  actualizarTelefonoEnFraccionamiento,
  crearControlEnFraccionamiento,
  crearDomicilioEnFraccionamiento,
  crearResidenteEnFraccionamiento,
  crearTarjetaEnFraccionamiento,
  crearTelefonoEnFraccionamiento,
  eliminarControlEnFraccionamiento,
  eliminarResidenteEnFraccionamiento,
  eliminarTarjetaEnFraccionamiento,
  eliminarTelefonoEnFraccionamiento,
  fijarPinDomicilioEnFraccionamiento,
  generarPinDomicilioEnFraccionamiento,
  quitarPinDomicilioEnFraccionamiento,
} from './operacion-actions'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn(), instalacionDe: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))
vi.mock('@/lib/access-core', async () => ({
  ...(await import('@/lib/access-core/errores')),
  fijarPin: vi.fn(),
  generarPin: vi.fn(),
  quitarPin: vi.fn(),
}))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getTenantContext: vi.fn(),
}))

const SUPER: TenantContext = {
  userId: 'u0',
  email: 'root@plataforma.mx',
  perfil: { nombre: 'Root', email: 'root@plataforma.mx', rol: 'super_admin', activo: true, fraccionamientoId: null },
  fraccionamiento: null,
}
const ADMIN: TenantContext = {
  ...SUPER,
  perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 7 },
  fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
}

const domicilio = { direccion: 'lago 1', fechaAlta: '2026-01-01', observaciones: '' }

function usar(tables: Record<string, FakeQuery | FakeQuery[]>) {
  const sb = fakeSupabase(tables)
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return sb
}

const eqs = (q: FakeQuery) => callsOf(q, 'eq').map((c) => c.args)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTenantContext).mockResolvedValue(SUPER)
  vi.mocked(instalacionDe).mockResolvedValue(null)
})

describe('permisos', () => {
  test('un administrador recibe MSG_NO_PERMISO en todas sin llamar a Supabase', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const resultados = await Promise.all([
      crearDomicilioEnFraccionamiento(7, domicilio),
      actualizarDomicilioEnFraccionamiento(7, 1, domicilio),
      crearResidenteEnFraccionamiento(7, 1, { nombre: 'ana' }),
      actualizarResidenteEnFraccionamiento(7, 2, 1, { nombre: 'ana' }),
      eliminarResidenteEnFraccionamiento(7, 2, 1),
      crearTelefonoEnFraccionamiento(7, 1, '5512345678'),
      actualizarTelefonoEnFraccionamiento(7, 2, 1, '5512345678'),
      eliminarTelefonoEnFraccionamiento(7, 2, 1),
      crearTarjetaEnFraccionamiento(7, 1, { numero: '123' }),
      actualizarTarjetaEnFraccionamiento(7, 2, 1, 'Auto'),
      eliminarTarjetaEnFraccionamiento(7, 2, 1),
    ])
    for (const r of resultados) expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createClient).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('crearDomicilioEnFraccionamiento', () => {
  test('inserta domicilio y domicilio_concepto con fraccionamiento_id y created_by del super admin', async () => {
    const existentes = fakeQuery({ data: [] })
    const creado = fakeQuery({ data: { id: 40 } })
    const concepto = fakeQuery()
    usar({ domicilios: [existentes, creado], domicilio_concepto: concepto })
    expect(await crearDomicilioEnFraccionamiento(7, { ...domicilio, conceptoId: '2' })).toEqual({
      ok: true,
      data: { id: 40 },
    })
    expect(eqs(existentes)).toEqual([
      ['direccion', 'LAGO 1'],
      ['fraccionamiento_id', 7],
    ])
    expect(callsOf(creado, 'insert')[0].args).toEqual([
      { direccion: 'LAGO 1', fecha_alta: '2026-01-01', observaciones: null, created_by: 'u0', fraccionamiento_id: 7 },
    ])
    expect(callsOf(concepto, 'insert')[0].args).toEqual([{ domicilio_id: 40, concepto_id: 2, fraccionamiento_id: 7 }])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7')
  })

  test('dirección repetida dentro del fraccionamiento → mensaje de duplicado sin insertar', async () => {
    const existentes = fakeQuery({ data: [{ id: 3 }] })
    const creado = fakeQuery({ data: { id: 40 } })
    usar({ domicilios: [existentes, creado], domicilio_concepto: fakeQuery() })
    expect(await crearDomicilioEnFraccionamiento(7, domicilio)).toEqual({ ok: false, error: MSG_DOMICILIO_DUPLICADO })
    expect(callsOf(creado, 'insert')).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('actualizarDomicilioEnFraccionamiento', () => {
  test('actualiza solo los datos, filtra por fraccionamiento y nunca toca domicilio_concepto', async () => {
    const lectura = fakeQuery({ data: { direccion: 'LAGO 1', observaciones: null } })
    const q = fakeQuery({ data: [{ id: 5 }] })
    const sb = usar({ domicilios: [lectura, q] })
    const input = { ...domicilio, conceptoId: 3 } as typeof domicilio
    expect(await actualizarDomicilioEnFraccionamiento(7, 5, input)).toEqual({ ok: true, data: undefined })
    expect(callsOf(q, 'update')[0].args).toEqual([
      { direccion: 'LAGO 1', fecha_alta: '2026-01-01', observaciones: null },
    ])
    expect(eqs(q)).toEqual([
      ['id', 5],
      ['fraccionamiento_id', 7],
    ])
    expect(eqs(lectura)).toEqual([
      ['id', 5],
      ['fraccionamiento_id', 7],
    ])
    expect(sb.from).not.toHaveBeenCalledWith('domicilio_concepto')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7/domicilios/5')
  })

  test('domicilio de otro fraccionamiento → mensaje de no encontrado, sin encolar ni escribir', async () => {
    const q = fakeQuery({ data: null })
    usar({ domicilios: q })
    const r = await actualizarDomicilioEnFraccionamiento(7, 5, domicilio)
    expect(r.ok).toBe(false)
    expect(callsOf(q, 'update')).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('residentes', () => {
  test('crear inserta con fraccionamiento_id y revalida el detalle del domicilio', async () => {
    const q = fakeQuery()
    usar({ residentes: q })
    expect(await crearResidenteEnFraccionamiento(7, 9, { nombre: 'juan pérez', telefono: '' })).toEqual({
      ok: true,
      data: undefined,
    })
    expect(callsOf(q, 'insert')[0].args).toEqual([
      { nombre: 'Juan Pérez', telefono: null, domicilio_id: 9, fraccionamiento_id: 7 },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7/domicilios/9')
  })

  test('actualizar filtra por id y fraccionamiento', async () => {
    const q = fakeQuery({ data: [{ id: 3 }] })
    usar({ residentes: [fakeQuery({ data: { id: 3, telefono: null, user_id: null } }), q] })
    expect((await actualizarResidenteEnFraccionamiento(7, 3, 9, { nombre: 'ana', esPrincipal: true })).ok).toBe(true)
    expect(callsOf(q, 'update')[0].args).toEqual([{ nombre: 'Ana', telefono: null, es_principal: true }])
    expect(eqs(q)).toEqual([
      ['id', 3],
      ['fraccionamiento_id', 7],
    ])
  })

  test('eliminar filtra por id y fraccionamiento', async () => {
    const q = fakeQuery({ data: [{ id: 3 }] })
    usar({ residentes: [fakeQuery({ data: { id: 3, telefono: null, user_id: null } }), q] })
    expect((await eliminarResidenteEnFraccionamiento(7, 3, 9)).ok).toBe(true)
    expect(callsOf(q, 'delete')).toHaveLength(1)
    expect(eqs(q)).toEqual([
      ['id', 3],
      ['fraccionamiento_id', 7],
    ])
  })

  test('eliminar un residente de otro fraccionamiento (0 filas) → falla', async () => {
    usar({ residentes: fakeQuery({ data: [] }) })
    expect((await eliminarResidenteEnFraccionamiento(7, 3, 9)).ok).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('teléfonos y tarjetas', () => {
  test('con 2 teléfonos en ese domicilio y fraccionamiento → mensaje de límite sin insertar', async () => {
    const q = fakeQuery({ count: 2 })
    usar({ telefonos_acceso: q })
    expect(await crearTelefonoEnFraccionamiento(7, 9, '5512345678')).toEqual({ ok: false, error: MSG_MAX_TELEFONOS })
    expect(eqs(q)).toEqual([
      ['domicilio_id', 9],
      ['fraccionamiento_id', 7],
    ])
    expect(callsOf(q, 'insert')).toHaveLength(0)
  })

  test('crear teléfono bajo el límite inserta con fraccionamiento_id', async () => {
    const q = fakeQuery({ count: 1 })
    usar({ telefonos_acceso: q })
    expect((await crearTelefonoEnFraccionamiento(7, 9, '5512345678')).ok).toBe(true)
    expect(callsOf(q, 'insert')[0].args).toEqual([{ domicilio_id: 9, telefono: '5512345678', fraccionamiento_id: 7 }])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7/domicilios/9')
  })

  test('con 3 tarjetas → mensaje de límite', async () => {
    usar({ tarjetas_acceso: fakeQuery({ count: 3 }) })
    expect(await crearTarjetaEnFraccionamiento(7, 9, { numero: '123' })).toEqual({ ok: false, error: MSG_MAX_TARJETAS })
  })

  test('crear tarjeta inserta con fraccionamiento_id y encola en ese fraccionamiento', async () => {
    vi.mocked(instalacionDe).mockResolvedValue({ fid: 7, instalacionId: 'inst-1' })
    const insert = fakeQuery({ data: { id: 31 } })
    usar({ tarjetas_acceso: [fakeQuery({ count: 0 }), insert] })
    expect((await crearTarjetaEnFraccionamiento(7, 9, { numero: '123' })).ok).toBe(true)
    expect(callsOf(insert, 'insert')[0].args).toEqual([
      { domicilio_id: 9, numero: '123', descripcion: null, fraccionamiento_id: 7 },
    ])
    expect(instalacionDe).toHaveBeenCalledWith(expect.anything(), 7)
    expect(vi.mocked(encolar).mock.calls[0][1]).toEqual([
      { fraccionamientoId: 7, domicilioId: 9, entidad: 'tarjeta', entidadId: 31, operacion: 'crear' },
    ])
  })

  test('actualizar tarjeta lee y escribe filtrando por id y fraccionamiento', async () => {
    const lectura = fakeQuery({ data: { id: 5, domicilio_id: 9, tarjeta_id: null } })
    const q = fakeQuery()
    usar({ tarjetas_acceso: [lectura, q] })
    expect((await actualizarTarjetaEnFraccionamiento(7, 5, 9, 'Auto')).ok).toBe(true)
    expect(callsOf(q, 'update')[0].args).toEqual([{ descripcion: 'Auto' }])
    expect(eqs(lectura)).toEqual([
      ['id', 5],
      ['fraccionamiento_id', 7],
    ])
    expect(eqs(q)).toEqual([
      ['id', 5],
      ['fraccionamiento_id', 7],
    ])
  })

  test('eliminar tarjeta de otro fraccionamiento → no encontrado, sin borrar', async () => {
    const q = fakeQuery({ data: null })
    usar({ tarjetas_acceso: q })
    expect(await eliminarTarjetaEnFraccionamiento(7, 5, 9)).toEqual({ ok: false, error: MSG_ACCESO_NO_ENCONTRADO })
    expect(callsOf(q, 'delete')).toHaveLength(0)
  })

  test('eliminar teléfono filtra por id y fraccionamiento', async () => {
    const q = fakeQuery({ data: [{ id: 4 }] })
    usar({ telefonos_acceso: q })
    expect((await eliminarTelefonoEnFraccionamiento(7, 4, 9)).ok).toBe(true)
    expect(callsOf(q, 'delete')).toHaveLength(1)
    expect(eqs(q)).toEqual([
      ['id', 4],
      ['fraccionamiento_id', 7],
    ])
  })
})

describe('controles y PIN', () => {
  const input = { botones: [{ boton: 1, rfCode: '55' }] }

  test('un administrador recibe MSG_NO_PERMISO en controles y PIN', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const resultados = await Promise.all([
      crearControlEnFraccionamiento(7, 9, input),
      actualizarControlEnFraccionamiento(7, 5, 9, input),
      eliminarControlEnFraccionamiento(7, 5, 9),
      fijarPinDomicilioEnFraccionamiento(7, 9, '1234'),
      generarPinDomicilioEnFraccionamiento(7, 9),
      quitarPinDomicilioEnFraccionamiento(7, 9),
    ])
    for (const r of resultados) expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createClient).not.toHaveBeenCalled()
  })

  test('con 2 controles → MSG_MAX_CONTROLES (contando en ese fraccionamiento)', async () => {
    const q = fakeQuery({ count: 2 })
    usar({ controles_acceso: q })
    expect(await crearControlEnFraccionamiento(7, 9, input)).toEqual({ ok: false, error: MSG_MAX_CONTROLES })
    expect(eqs(q)).toEqual([
      ['domicilio_id', 9],
      ['fraccionamiento_id', 7],
    ])
  })

  test('crear control inserta con fraccionamiento_id y encola en ese fraccionamiento', async () => {
    vi.mocked(instalacionDe).mockResolvedValue({ fid: 7, instalacionId: 'inst-1' })
    const insert = fakeQuery({ data: { id: 41 } })
    usar({ controles_acceso: [fakeQuery({ count: 0 }), insert] })
    expect((await crearControlEnFraccionamiento(7, 9, input)).ok).toBe(true)
    expect(callsOf(insert, 'insert')[0].args).toEqual([
      { domicilio_id: 9, descripcion: null, botones: [{ boton: 1, rf_code: 55, boton_id: null }], fraccionamiento_id: 7 },
    ])
    expect(instalacionDe).toHaveBeenCalledWith(expect.anything(), 7)
    expect(vi.mocked(encolar).mock.calls[0][1]).toEqual([
      { fraccionamientoId: 7, domicilioId: 9, entidad: 'control', entidadId: 41, operacion: 'crear' },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7/domicilios/9')
  })

  test('eliminar control de otro fraccionamiento → no encontrado, sin encolar ni borrar', async () => {
    const q = fakeQuery({ data: null })
    usar({ controles_acceso: q })
    expect(await eliminarControlEnFraccionamiento(7, 5, 9)).toEqual({ ok: false, error: MSG_ACCESO_NO_ENCONTRADO })
    expect(eqs(q)).toEqual([
      ['id', 5],
      ['fraccionamiento_id', 7],
    ])
    expect(callsOf(q, 'delete')).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('fijar PIN lee el domicilio filtrando por el fraccionamiento y guarda con él', async () => {
    vi.mocked(instalacionDe).mockResolvedValue({ fid: 7, instalacionId: 'inst-1' })
    const dom = fakeQuery({ data: { titular_id: 'tit-1', fraccionamiento_id: 7 } })
    const pines = fakeQuery()
    usar({ domicilios: dom, pines_acceso: pines })
    expect((await fijarPinDomicilioEnFraccionamiento(7, 9, '1234')).ok).toBe(true)
    expect(eqs(dom)).toEqual([
      ['id', 9],
      ['fraccionamiento_id', 7],
    ])
    expect(fijarPin).toHaveBeenCalledWith('inst-1', 'tit-1', '1234')
    expect(callsOf(pines, 'upsert')[0].args[0]).toMatchObject({ domicilio_id: 9, fraccionamiento_id: 7, pin: '1234' })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/7/domicilios/9')
  })

  test('PIN de un domicilio de otro fraccionamiento → no encontrado sin llamar a la API', async () => {
    usar({ domicilios: fakeQuery({ data: null }), pines_acceso: fakeQuery() })
    expect(await generarPinDomicilioEnFraccionamiento(7, 9)).toEqual({ ok: false, error: MSG_DOMICILIO_NO_ENCONTRADO })
    expect(generarPin).not.toHaveBeenCalled()
  })
})
