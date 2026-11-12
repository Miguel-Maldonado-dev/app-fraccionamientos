import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getTenantContext, type TenantContext } from '@/lib/auth/tenant-context'
import { MSG_ERROR, MSG_NO_PERMISO, MSG_SESION } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { actualizarFraccionamiento, crearFraccionamiento } from './actions'
import { encolar } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import {
  MSG_FRACCIONAMIENTO_NO_EXISTE,
  MSG_INSTALACION_DUPLICADA,
  MSG_INSTALACION_EN_USO,
  MSG_SLUG_DUPLICADO,
} from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))
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
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const input = { nombre: ' Lomas del Río ', slug: 'lomas-del-rio', instalacionId: UUID, instalacionNombre: 'Norte', activo: true }
const fila = {
  nombre: 'Lomas del Río',
  slug: 'lomas-del-rio',
  instalacion_id: UUID,
  instalacion_nombre: 'Norte',
  activo: true,
}
const OTRO = '9a1b2c3d-4e5f-41a2-8b3c-0123456789ab'

const dupSlug = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "fraccionamientos_slug_key"',
  details: 'Key (slug)=(lomas-del-rio) already exists.',
}
const dupInstalacion = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "fraccionamientos_instalacion_id_key"',
  details: `Key (instalacion_id)=(${UUID}) already exists.`,
}

const usar = (q: ReturnType<typeof fakeQuery>) => {
  const sb = fakeSupabase({ fraccionamientos: q })
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return sb
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTenantContext).mockResolvedValue(SUPER)
})

describe('crearFraccionamiento', () => {
  test('inserta las columnas, devuelve el id y revalida /admin', async () => {
    const q = fakeQuery({ data: { id: 12 } })
    usar(q)
    const r = await crearFraccionamiento(input)
    expect(r).toEqual({ ok: true, data: { id: 12 } })
    expect(callsOf(q, 'insert')[0].args).toEqual([fila])
    expect(callsOf(q, 'select')[0].args).toEqual(['id'])
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([['/admin'], ['/admin/fraccionamientos']])
  })

  test('instalación vacía se guarda como null', async () => {
    const q = fakeQuery({ data: { id: 13 } })
    usar(q)
    await crearFraccionamiento({ ...input, instalacionId: '' })
    expect(callsOf(q, 'insert')[0].args).toEqual([{ ...fila, instalacion_id: null, instalacion_nombre: null }])
  })

  test('datos inválidos no escriben', async () => {
    const sb = usar(fakeQuery())
    const r = await crearFraccionamiento({ ...input, slug: 'Lomas' })
    expect(r).toEqual({ ok: false, error: 'Usa minúsculas, números y guiones' })
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('slug repetido → MSG_SLUG_DUPLICADO', async () => {
    usar(fakeQuery({ error: dupSlug }))
    expect(await crearFraccionamiento(input)).toEqual({ ok: false, error: MSG_SLUG_DUPLICADO })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('instalación repetida → MSG_INSTALACION_DUPLICADA', async () => {
    usar(fakeQuery({ error: dupInstalacion }))
    expect(await crearFraccionamiento(input)).toEqual({ ok: false, error: MSG_INSTALACION_DUPLICADA })
  })

  test('slug repetido que contiene "instalacion" → MSG_SLUG_DUPLICADO', async () => {
    usar(
      fakeQuery({
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "fraccionamientos_slug_key"',
          details: 'Key (slug)=(instalacion-norte) already exists.',
        },
      }),
    )
    expect(await crearFraccionamiento({ ...input, slug: 'instalacion-norte' })).toEqual({
      ok: false,
      error: MSG_SLUG_DUPLICADO,
    })
  })

  test('23505 de otra restricción → MSG_ERROR', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    usar(
      fakeQuery({
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "otra_key"',
          details: 'Key (slug, instalacion_id)=(x, y) already exists.',
        },
      }),
    )
    expect(await crearFraccionamiento(input)).toEqual({ ok: false, error: MSG_ERROR })
    consoleError.mockRestore()
  })

  test('otro error de base → MSG_ERROR', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    usar(fakeQuery({ error: { code: '42501', message: 'permission denied' } }))
    expect(await crearFraccionamiento(input)).toEqual({ ok: false, error: MSG_ERROR })
    consoleError.mockRestore()
  })

  test('administrador de fraccionamiento → MSG_NO_PERMISO sin tocar la base', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const sb = usar(fakeQuery())
    expect(await crearFraccionamiento(input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('sin sesión → MSG_SESION', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(null)
    usar(fakeQuery())
    expect(await crearFraccionamiento(input)).toEqual({ ok: false, error: MSG_SESION })
  })
})

const usarActualizar = (opts: {
  actual?: { instalacion_id: string | null } | null
  update?: ReturnType<typeof fakeQuery>
  domicilios?: ReturnType<typeof fakeQuery>[]
  tareas?: ReturnType<typeof fakeQuery>
}) => {
  const actual = fakeQuery({ data: opts.actual === undefined ? { instalacion_id: UUID } : opts.actual })
  const update = opts.update ?? fakeQuery({ data: [{ id: 4 }] })
  const sb = fakeSupabase({
    fraccionamientos: [actual, update],
    domicilios: opts.domicilios ?? [fakeQuery({ count: 0 })],
    sincronizaciones_acceso: opts.tareas ?? fakeQuery({ data: [] }),
  })
  sb.rpc.mockResolvedValue({ data: 0, error: null })
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return { sb, actual, update }
}

describe('actualizarFraccionamiento', () => {
  test('actualiza por id las columnas y revalida /admin y el detalle', async () => {
    const { update } = usarActualizar({})
    const r = await actualizarFraccionamiento(4, { ...input, activo: false })
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(update, 'update')[0].args).toEqual([{ ...fila, activo: false }])
    expect(callsOf(update, 'eq')[0].args).toEqual(['id', 4])
    expect(callsOf(update, 'select')[0].args).toEqual(['id'])
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ['/admin'],
      ['/admin/fraccionamientos'],
      ['/admin/fraccionamientos/4'],
    ])
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('el fraccionamiento no existe → MSG_FRACCIONAMIENTO_NO_EXISTE sin escribir', async () => {
    const { update } = usarActualizar({ actual: null })
    expect(await actualizarFraccionamiento(99, input)).toEqual({ ok: false, error: MSG_FRACCIONAMIENTO_NO_EXISTE })
    expect(update.calls).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('0 filas afectadas → MSG_FRACCIONAMIENTO_NO_EXISTE', async () => {
    usarActualizar({ update: fakeQuery({ data: [] }) })
    expect(await actualizarFraccionamiento(99, input)).toEqual({ ok: false, error: MSG_FRACCIONAMIENTO_NO_EXISTE })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('slug repetido → MSG_SLUG_DUPLICADO', async () => {
    usarActualizar({ update: fakeQuery({ error: dupSlug }) })
    expect(await actualizarFraccionamiento(4, input)).toEqual({ ok: false, error: MSG_SLUG_DUPLICADO })
  })

  test('instalación repetida → MSG_INSTALACION_DUPLICADA', async () => {
    usarActualizar({ update: fakeQuery({ error: dupInstalacion }) })
    expect(await actualizarFraccionamiento(4, input)).toEqual({ ok: false, error: MSG_INSTALACION_DUPLICADA })
  })

  test('administrador de fraccionamiento → MSG_NO_PERMISO', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const { sb } = usarActualizar({})
    expect(await actualizarFraccionamiento(4, input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('cambiar la instalación con un domicilio sincronizado → MSG_INSTALACION_EN_USO', async () => {
    const { update } = usarActualizar({ domicilios: [fakeQuery({ count: 1 })] })
    const r = await actualizarFraccionamiento(4, { ...input, instalacionId: OTRO })
    expect(r).toEqual({ ok: false, error: MSG_INSTALACION_EN_USO })
    expect(MSG_INSTALACION_EN_USO).toBe('Este fraccionamiento ya tiene domicilios sincronizados con su instalación')
    expect(update.calls).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('quitar la instalación con un domicilio sincronizado → MSG_INSTALACION_EN_USO', async () => {
    usarActualizar({ domicilios: [fakeQuery({ count: 2 })] })
    expect(await actualizarFraccionamiento(4, { ...input, instalacionId: '', instalacionNombre: null })).toEqual({
      ok: false,
      error: MSG_INSTALACION_EN_USO,
    })
  })

  test('cambiar la instalación sin domicilios sincronizados guarda', async () => {
    const dom = fakeQuery({ count: 0 })
    const { update } = usarActualizar({ domicilios: [dom, fakeQuery({ data: [] })] })
    const r = await actualizarFraccionamiento(4, { ...input, instalacionId: OTRO })
    expect(r.ok).toBe(true)
    expect(callsOf(dom, 'not')[0].args).toEqual(['titular_id', 'is', null])
    expect(callsOf(update, 'update')[0].args[0]).toMatchObject({ instalacion_id: OTRO })
  })

  test('conservar la misma instalación no pide el chequeo de titulares ni cancela tareas', async () => {
    const dom = fakeQuery({ data: [] })
    const { sb } = usarActualizar({ domicilios: [dom] })
    await actualizarFraccionamiento(4, input)
    expect(callsOf(dom, 'not')).toHaveLength(0)
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  test('el RPC de cancelar se llama antes del update', async () => {
    const { sb, update } = usarActualizar({ actual: { instalacion_id: null } })
    let llamadasAlUpdateAlCancelar = -1
    sb.rpc.mockImplementation(async () => {
      llamadasAlUpdateAlCancelar = update.calls.length
      return { data: 0, error: null }
    })
    await actualizarFraccionamiento(4, input)
    expect(llamadasAlUpdateAlCancelar).toBe(0)
    expect(callsOf(update, 'update')).toHaveLength(1)
  })

  test('si el RPC falla no hay update ni encolado', async () => {
    const { sb, update } = usarActualizar({ actual: { instalacion_id: null } })
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await actualizarFraccionamiento(4, input)).ok).toBe(false)
    expect(update.calls).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('con una sincronización en curso (P0001) avisa y no guarda', async () => {
    const { sb, update } = usarActualizar({ actual: { instalacion_id: null } })
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'sincronización en curso', code: 'P0001' } })
    expect(await actualizarFraccionamiento(4, input)).toEqual({
      ok: false,
      error: 'Hay una sincronización en curso; intenta en unos minutos.',
    })
    expect(update.calls).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('si el update falla tras cancelar, el reintento vuelve a cancelar y vincula', async () => {
    const filas = [{ id: 8, direccion: 'A', observaciones: null }]
    const falla = usarActualizar({
      actual: { instalacion_id: null },
      update: fakeQuery({ error: dupInstalacion }),
      domicilios: [fakeQuery({ data: filas })],
    })
    expect((await actualizarFraccionamiento(4, input)).ok).toBe(false)
    expect(falla.sb.rpc).toHaveBeenCalledTimes(1)
    expect(encolar).not.toHaveBeenCalled()
    const retry = usarActualizar({ actual: { instalacion_id: null }, domicilios: [fakeQuery({ data: filas })] })
    expect((await actualizarFraccionamiento(4, input)).ok).toBe(true)
    expect(retry.sb.rpc).toHaveBeenCalledTimes(1)
    expect(encolar).toHaveBeenCalledTimes(1)
  })

  test('cambiar la instalación cancela las tareas sin terminar ANTES de encolar las nuevas', async () => {
    const lista = fakeQuery({ data: [{ id: 8, direccion: 'LAGO 1', observaciones: null }] })
    const { sb } = usarActualizar({ domicilios: [fakeQuery({ count: 0 }), lista] })
    await actualizarFraccionamiento(4, { ...input, instalacionId: OTRO })
    expect(sb.rpc).toHaveBeenCalledWith('cancelar_sincronizaciones', { p_fraccionamiento_id: 4 })
    expect(sb.rpc.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(encolar).mock.invocationCallOrder[0])
  })

  test('quitar la instalación cancela las tareas y no encola', async () => {
    const { sb } = usarActualizar({})
    await actualizarFraccionamiento(4, { ...input, instalacionId: '', instalacionNombre: null })
    expect(sb.rpc).toHaveBeenCalledWith('cancelar_sincronizaciones', { p_fraccionamiento_id: 4 })
    expect(encolar).not.toHaveBeenCalled()
  })

  test('si el RPC de cancelar falla no encola', async () => {
    const lista = fakeQuery({ data: [{ id: 8, direccion: 'LAGO 1', observaciones: null }] })
    const { sb } = usarActualizar({ actual: { instalacion_id: null }, domicilios: [lista] })
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await actualizarFraccionamiento(4, input)).ok).toBe(false)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('un fallo al encolar tras guardar se recupera guardando de nuevo; con todo encolado no repite', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const filas = [{ id: 8, direccion: 'LAGO 1', observaciones: null }]
    // Primer guardado: vincula y encolar falla.
    vi.mocked(encolar).mockRejectedValueOnce(new Error('cola caída'))
    usarActualizar({ actual: { instalacion_id: null }, domicilios: [fakeQuery({ data: filas })] })
    expect((await actualizarFraccionamiento(4, input)).ok).toBe(false)
    expect(dispararSincronizacion).not.toHaveBeenCalled()
    // Segundo guardado: la instalación ya está vinculada (sin cambio) y no hay tareas: encola.
    usarActualizar({ domicilios: [fakeQuery({ data: filas })] })
    expect((await actualizarFraccionamiento(4, input)).ok).toBe(true)
    expect(vi.mocked(encolar).mock.calls[1][1]).toHaveLength(3)
    expect(dispararSincronizacion).toHaveBeenCalledWith(4)
    // Tercer guardado: ya hay un `domicilio crear` pendiente: no encola nada más.
    vi.mocked(encolar).mockClear()
    usarActualizar({
      domicilios: [fakeQuery({ data: filas })],
      tareas: fakeQuery({ data: [{ domicilio_id: 8 }] }),
    })
    expect((await actualizarFraccionamiento(4, input)).ok).toBe(true)
    expect(encolar).not.toHaveBeenCalled()
  })

  test('solo consulta domicilios sin titular y tareas crear sin terminar', async () => {
    const dom = fakeQuery({ data: [] })
    const tareas = fakeQuery({ data: [] })
    usarActualizar({ domicilios: [dom], tareas })
    await actualizarFraccionamiento(4, input)
    expect(callsOf(dom, 'is')[0].args).toEqual(['titular_id', null])
  })

  test('solo encola los domicilios que no tienen crear pendiente', async () => {
    const lista = fakeQuery({
      data: [
        { id: 8, direccion: 'A', observaciones: null },
        { id: 9, direccion: 'B', observaciones: null },
      ],
    })
    const tareas = fakeQuery({ data: [{ domicilio_id: 8 }] })
    usarActualizar({ domicilios: [lista], tareas })
    await actualizarFraccionamiento(4, input)
    expect(vi.mocked(encolar).mock.calls[0][1].map((t) => t.domicilioId)).toEqual([9, 9, 9])
    expect(callsOf(tareas, 'in')[0].args).toEqual(['estado', ['pendiente', 'error']])
  })

  test('vincular encola crear, reconciliar y asignar por domicilio en orden y dispara', async () => {
    const lista = fakeQuery({
      data: [
        { id: 8, direccion: 'LAGO 1', observaciones: null },
        { id: 9, direccion: 'LAGO 2', observaciones: 'Esquina' },
      ],
    })
    const { sb } = usarActualizar({ actual: { instalacion_id: null }, domicilios: [lista] })
    const r = await actualizarFraccionamiento(4, input)
    expect(r.ok).toBe(true)
    expect(callsOf(lista, 'order')[0].args[0]).toBe('id')
    expect(callsOf(lista, 'is')[0].args).toEqual(['titular_id', null])
    expect(sb.rpc).toHaveBeenCalledWith('cancelar_sincronizaciones', { p_fraccionamiento_id: 4 })
    const tareas = vi.mocked(encolar).mock.calls[0][1]
    expect(tareas.map((t) => [t.domicilioId, t.operacion])).toEqual([
      [8, 'crear'],
      [8, 'reconciliar'],
      [8, 'asignar'],
      [9, 'crear'],
      [9, 'reconciliar'],
      [9, 'asignar'],
    ])
    expect(tareas[0]).toEqual({
      fraccionamientoId: 4,
      domicilioId: 8,
      entidad: 'domicilio',
      entidadId: 8,
      operacion: 'crear',
      carga: { kind: 'domicilio', name: 'LAGO 1', address: 'LAGO 1', notes: '' },
    })
    expect(tareas[3].carga).toEqual({ kind: 'domicilio', name: 'LAGO 2', address: 'LAGO 2', notes: 'Esquina' })
    expect(tareas[1].entidadId).toBeNull()
    expect(tareas[2].entidadId).toBeNull()
    expect(dispararSincronizacion).toHaveBeenCalledWith(4)
  })

  test('vincular sin domicilios no encola ni dispara', async () => {
    usarActualizar({ actual: { instalacion_id: null }, domicilios: [fakeQuery({ data: [] })] })
    await actualizarFraccionamiento(4, input)
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('si el update falla no encola', async () => {
    usarActualizar({ actual: { instalacion_id: null }, update: fakeQuery({ error: dupInstalacion }) })
    await actualizarFraccionamiento(4, input)
    expect(encolar).not.toHaveBeenCalled()
  })
})
