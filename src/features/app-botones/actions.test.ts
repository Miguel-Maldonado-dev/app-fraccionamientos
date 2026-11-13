import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getTenantContext, type TenantContext } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { listarSalidas } from '@/lib/access-core'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { eliminarBoton, guardarBoton, reordenarBotones } from './actions'
import {
  MSG_ACCESS_CORE,
  MSG_MAXIMO_BOTONES,
  MSG_ORDEN_INVALIDO,
  MSG_SALIDA_NO_EXISTE,
  MSG_SIN_INSTALACION,
} from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/access-core', () => ({ listarSalidas: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getTenantContext: vi.fn(),
}))

const SUPER: TenantContext = {
  userId: 'u0',
  email: 'root@plataforma.mx',
  perfil: {
    nombre: 'Root',
    email: 'root@plataforma.mx',
    rol: 'super_admin',
    activo: true,
    fraccionamientoId: null,
  },
  fraccionamiento: null,
}
const ADMIN: TenantContext = {
  ...SUPER,
  perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 4 },
  fraccionamiento: { id: 4, nombre: 'A', slug: 'a', activo: true } as never,
}
const INST = '9a1b2c3d-4e5f-41a2-8b3c-0123456789ab'
const S1 = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const input = {
  nombre: 'Pluma',
  icono: 'pluma' as const,
  estilo: 'azul_claro' as const,
  anchoCompleto: false,
  salidaId: S1,
}

function usar(
  opts: {
    instalacion?: string | null
    existentes?: { orden: number }[]
    mutacion?: unknown
    rpcError?: unknown
  } = {},
) {
  const fracc = fakeQuery({
    data: {
      instalacion_id: opts.instalacion === undefined ? INST : opts.instalacion,
    },
  })
  const botones = fakeQuery({ data: opts.mutacion ?? opts.existentes ?? [] })
  const insertar = fakeQuery({ data: null })
  const rpc = vi.fn().mockResolvedValue({ data: null, error: opts.rpcError ?? null })
  const sb = fakeSupabase({ fraccionamientos: fracc, app_botones: [botones, insertar] }, { rpc })
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return { botones, insertar, rpc }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTenantContext).mockResolvedValue(SUPER)
  vi.mocked(listarSalidas).mockResolvedValue([
    {
      id: S1,
      panel_id: 'p',
      output_index: 0,
      alias: 'Pluma entrada',
      duration_ms: 1,
      reader_mask: 0,
      enabled: true,
    },
  ])
})

describe('permisos', () => {
  test('rechazan a quien no es super admin', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const { rpc } = usar()
    expect(await guardarBoton(4, input)).toEqual({
      ok: false,
      error: MSG_NO_PERMISO,
    })
    expect(await eliminarBoton(4, 1)).toEqual({
      ok: false,
      error: MSG_NO_PERMISO,
    })
    expect(await reordenarBotones(4, [1, 2])).toEqual({
      ok: false,
      error: MSG_NO_PERMISO,
    })
    expect(createClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('guardarBoton', () => {
  test('crea al final copiando el alias de la salida', async () => {
    const { insertar } = usar({ existentes: [{ orden: 1 }, { orden: 2 }] })
    expect(await guardarBoton(4, input)).toEqual({ ok: true, data: undefined })
    expect(callsOf(insertar, 'insert')[0].args[0]).toEqual({
      fraccionamiento_id: 4,
      orden: 3,
      nombre: 'Pluma',
      icono: 'pluma',
      estilo: 'azul_claro',
      ancho_completo: false,
      salida_id: S1,
      salida_nombre: 'Pluma entrada',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/4')
  })

  test('con 8 botones no inserta', async () => {
    const { insertar } = usar({
      existentes: [1, 2, 3, 4, 5, 6, 7, 8].map((orden) => ({ orden })),
    })
    expect(await guardarBoton(4, input)).toEqual({
      ok: false,
      error: MSG_MAXIMO_BOTONES,
    })
    expect(callsOf(insertar, 'insert')).toHaveLength(0)
  })

  test('usa un hueco si el último orden es 8', async () => {
    const { insertar } = usar({
      existentes: [1, 2, 4, 8].map((orden) => ({ orden })),
    })
    await guardarBoton(4, input)
    expect((callsOf(insertar, 'insert')[0].args[0] as { orden: number }).orden).toBe(3)
  })

  test('salida inexistente o access-core caído', async () => {
    usar()
    vi.mocked(listarSalidas).mockResolvedValueOnce([])
    expect(await guardarBoton(4, input)).toEqual({
      ok: false,
      error: MSG_SALIDA_NO_EXISTE,
    })
    vi.mocked(listarSalidas).mockRejectedValueOnce(new Error('x'))
    expect(await guardarBoton(4, input)).toEqual({
      ok: false,
      error: MSG_ACCESS_CORE,
    })
  })

  test('sin instalación no acepta salida, pero sí un botón sin salida', async () => {
    usar({ instalacion: null })
    expect(await guardarBoton(4, input)).toEqual({
      ok: false,
      error: MSG_SIN_INSTALACION,
    })
    const { insertar } = usar({ instalacion: null })
    expect(await guardarBoton(4, { ...input, salidaId: null })).toEqual({
      ok: true,
      data: undefined,
    })
    expect(callsOf(insertar, 'insert')[0].args[0]).toMatchObject({
      salida_id: null,
      salida_nombre: null,
    })
    expect(listarSalidas).not.toHaveBeenCalled()
  })

  test('edita por id dentro del fraccionamiento', async () => {
    const { botones } = usar({ mutacion: [{ id: 7 }] })
    expect(await guardarBoton(4, { ...input, anchoCompleto: true, id: 7 })).toEqual({ ok: true, data: undefined })
    expect(callsOf(botones, 'update')[0].args[0]).toMatchObject({
      ancho_completo: true,
      salida_nombre: 'Pluma entrada',
    })
    expect(callsOf(botones, 'eq').map((c) => c.args)).toEqual([
      ['id', 7],
      ['fraccionamiento_id', 4],
    ])
  })

  test('guarda el estilo elegido al crear y al editar', async () => {
    const { insertar } = usar()
    expect(await guardarBoton(4, { ...input, estilo: 'navy' })).toEqual({ ok: true, data: undefined })
    expect(callsOf(insertar, 'insert')[0].args[0]).toMatchObject({ estilo: 'navy' })
    const { botones } = usar({ mutacion: [{ id: 7 }] })
    await guardarBoton(4, { ...input, estilo: 'navy', id: 7 })
    expect(callsOf(botones, 'update')[0].args[0]).toMatchObject({ estilo: 'navy' })
  })

  test('estilo inválido: error de validación sin tocar la base', async () => {
    usar()
    const r = await guardarBoton(4, { ...input, estilo: 'rojo' as never })
    expect(r.ok).toBe(false)
    expect(createClient).not.toHaveBeenCalled()
  })

  test('sin estilo usa azul_claro', async () => {
    const { insertar } = usar()
    const sinEstilo: Record<string, unknown> & typeof input = { ...input }
    delete (sinEstilo as { estilo?: string }).estilo
    await guardarBoton(4, sinEstilo)
    expect(callsOf(insertar, 'insert')[0].args[0]).toMatchObject({ estilo: 'azul_claro' })
  })

  test('valida el nombre', async () => {
    usar()
    const r = await guardarBoton(4, { ...input, nombre: '   ' })
    expect(r.ok).toBe(false)
  })
})

describe('eliminarBoton', () => {
  test('borra del fraccionamiento', async () => {
    const { botones } = usar({ mutacion: [{ id: 7 }] })
    expect(await eliminarBoton(4, 7)).toEqual({ ok: true, data: undefined })
    expect(callsOf(botones, 'delete')).toHaveLength(1)
  })
})

describe('reordenarBotones', () => {
  test('llama a la RPC con los ids en orden', async () => {
    const { rpc } = usar()
    expect(await reordenarBotones(4, [3, 1, 2])).toEqual({
      ok: true,
      data: undefined,
    })
    expect(rpc).toHaveBeenCalledWith('reordenar_app_botones', {
      p_fraccionamiento_id: 4,
      p_ids: [3, 1, 2],
    })
  })

  test('ids repetidos o lista desfasada', async () => {
    const { rpc } = usar({ rpcError: { code: '22023', message: 'x' } })
    expect(await reordenarBotones(4, [1, 1])).toEqual({
      ok: false,
      error: MSG_ORDEN_INVALIDO,
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(await reordenarBotones(4, [1, 2])).toEqual({
      ok: false,
      error: MSG_ORDEN_INVALIDO,
    })
  })
})
