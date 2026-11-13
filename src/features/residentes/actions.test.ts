import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { actualizarResidente, crearResidente, eliminarResidente } from './actions'
import { MSG_TELEFONO_CON_ACCESO_APP } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn() }))

const user = { id: 'u1', email: 'a@b.c', userName: 'Ana', roleName: 'administrador', isActive: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
})

describe('crearResidente', () => {
  test('inserta sin es_principal y con nombre en title case', async () => {
    const q = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: q }) as never)
    const r = await crearResidente(9, { nombre: 'juan pérez', telefono: '' })
    expect(r).toEqual({ ok: true, data: undefined })
    const payload = callsOf(q, 'insert')[0].args[0] as Record<string, unknown>
    expect(payload).toEqual({ nombre: 'Juan Pérez', telefono: null, domicilio_id: 9 })
    expect(payload).not.toHaveProperty('es_principal')
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
    expect(revalidatePath).toHaveBeenCalledWith('/residentes')
  })

  test('rechaza datos inválidos sin insertar', async () => {
    const q = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: q }) as never)
    const r = await crearResidente(9, { nombre: '', telefono: '12' })
    expect(r).toEqual({ ok: false, error: 'El nombre es obligatorio' })
    expect(callsOf(q, 'insert')).toHaveLength(0)
  })
})

describe('actualizarResidente', () => {
  test('envía es_principal true', async () => {
    const q = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: [fakeQuery({}), q] }) as never)
    const r = await actualizarResidente(3, 9, { nombre: 'ana', telefono: '5512345678', esPrincipal: true })
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(q, 'update')[0].args).toEqual([
      { nombre: 'Ana', telefono: '5512345678', es_principal: true },
    ])
    expect(callsOf(q, 'eq')[0].args).toEqual(['id', 3])
  })

  test('es_principal false por defecto', async () => {
    const q = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: q }) as never)
    await actualizarResidente(3, 9, { nombre: 'ana' })
    expect(callsOf(q, 'update')[0].args).toEqual([{ nombre: 'Ana', telefono: null, es_principal: false }])
  })

  test('con acceso a la app no permite cambiar el teléfono', async () => {
    const q = fakeQuery({})
    const actual = fakeQuery({ data: { id: 3, telefono: '5512345678', user_id: 'c1' } })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: [actual, q] }) as never)
    const r = await actualizarResidente(3, 9, { nombre: 'ana', telefono: '5587654321' })
    expect(r).toEqual({ ok: false, error: MSG_TELEFONO_CON_ACCESO_APP })
    expect(callsOf(q, 'update')).toHaveLength(0)
  })

  test('con acceso a la app permite editar otros campos con el mismo teléfono', async () => {
    const q = fakeQuery({})
    const actual = fakeQuery({ data: { id: 3, telefono: '5512345678', user_id: 'c1' } })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: [actual, q] }) as never)
    const r = await actualizarResidente(3, 9, { nombre: 'ana', telefono: '5512345678', esPrincipal: true })
    expect(r.ok).toBe(true)
    expect(callsOf(q, 'update')[0].args).toEqual([{ nombre: 'Ana', telefono: '5512345678', es_principal: true }])
  })
})

describe('eliminarResidente', () => {
  test('elimina y revalida ambas rutas', async () => {
    const q = fakeQuery({})
    const actual = fakeQuery({ data: { id: 3, telefono: null, user_id: null } })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: [actual, q] }) as never)
    const r = await eliminarResidente(3, 9)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(q, 'eq')[0].args).toEqual(['id', 3])
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
    expect(revalidatePath).toHaveBeenCalledWith('/residentes')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('con acceso a la app borra su teléfono autoregistrado y desactiva la cuenta sin domicilios', async () => {
    const q = fakeQuery({})
    const actual = fakeQuery({ data: { id: 3, telefono: '5512345678', user_id: 'c1' } })
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: [actual, q] }) as never)
    const ta = fakeQuery({})
    const cuentas = fakeQuery({})
    const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null })
    vi.mocked(createAdminClient).mockReturnValue(
      fakeSupabase(
        { telefonos_acceso: ta, residentes: fakeQuery({ count: 0 }), cuentas_residente: cuentas },
        { auth: { admin: { updateUserById } } },
      ) as never,
    )
    const r = await eliminarResidente(3, 9)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(ta, 'delete')).toHaveLength(1)
    expect(callsOf(ta, 'eq')[0].args).toEqual(['residente_id', 3])
    expect(callsOf(q, 'delete')).toHaveLength(1)
    expect(callsOf(cuentas, 'update')[0].args).toEqual([{ activo: false }])
    expect(updateUserById).toHaveBeenCalledWith('c1', { ban_duration: '876000h' })
  })

  test('residente no visible ⇒ no encontrado sin service-role', async () => {
    const q = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ residentes: [fakeQuery({}), q] }) as never)
    const r = await eliminarResidente(3, 9)
    expect(r.ok).toBe(false)
    expect(callsOf(q, 'delete')).toHaveLength(0)
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})

describe('permisos', () => {
  test('un tesorero no puede crear, actualizar ni eliminar residentes', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, roleName: 'tesorero' } as never)
    expect(await crearResidente(9, { nombre: 'ana' })).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await actualizarResidente(3, 9, { nombre: 'ana' })).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await eliminarResidente(3, 9)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('crearResidente con darAcceso', () => {
  test('si la cuenta falla, el residente queda creado y se informa', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const ins = fakeQuery({ data: { id: 5 } })
    const ver = fakeQuery({ data: { id: 5, domicilio_id: 9, fraccionamiento_id: 1, user_id: null } })
    const s = fakeSupabase({ residentes: [ins, ver], fraccionamientos: fakeQuery({ data: { max_residentes_app: 2 } }) })
    s.rpc.mockResolvedValue({ data: 0, error: null })
    vi.mocked(createClient).mockResolvedValue(s as never)
    vi.mocked(createAdminClient).mockReturnValue(
      fakeSupabase({ cuentas_residente: fakeQuery({}) }, { auth: { admin: {} } }) as never,
    )
    const r = await crearResidente(9, { nombre: 'ana', telefono: '3312345678', darAcceso: true })
    expect(r.ok).toBe(false)
    expect(callsOf(ins, 'insert')).toHaveLength(1)
    expect(callsOf(ins, 'delete')).toHaveLength(0)
  })
})
