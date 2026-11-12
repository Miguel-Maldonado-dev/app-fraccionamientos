import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { MSG_ERROR, MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { actualizarUsuario, cambiarEstadoUsuario, crearUsuario } from './actions'
import { MSG_EMAIL_DUPLICADO, MSG_NO_AUTO_CAMBIAR_ROL, MSG_NO_AUTO_DESACTIVAR } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn() }))

const userWith = (roleName: string) =>
  ({ id: 'u1', email: 'a@b.c', userName: 'Ana', roleName, isActive: true, fraccionamientoId: 42 }) as never

const input = { userName: 'ana lopez', email: 'ana@lago.mx', password: '123456', rol: 'tesorero' as const }

function fakeAdmin({
  createUser = { data: { user: { id: 'nuevo-id' } }, error: null } as unknown,
  perfiles = fakeQuery({}) as FakeQuery,
} = {}) {
  const admin = {
    createUser: vi.fn().mockResolvedValue(createUser),
    deleteUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  }
  vi.mocked(createAdminClient).mockReturnValue(fakeSupabase({ perfiles }, { auth: { admin } }) as never)
  return { admin, perfiles }
}

afterEach(() => vi.restoreAllMocks())

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(userWith('administrador'))
  vi.mocked(createClient).mockResolvedValue(fakeSupabase({}) as never)
})

describe('crearUsuario', () => {
  test('rechaza a quien no es Administrador sin tocar el cliente admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith('tesorero'))
    const r = await crearUsuario(input)
    expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('crea el usuario en auth y el perfil en el fraccionamiento del administrador', async () => {
    const f = fakeAdmin()
    const r = await crearUsuario(input)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(f.admin.createUser).toHaveBeenCalledWith({ email: 'ana@lago.mx', password: '123456', email_confirm: true })
    expect(callsOf(f.perfiles, 'insert')[0].args).toEqual([
      { id: 'nuevo-id', fraccionamiento_id: 42, rol: 'tesorero', nombre: 'Ana Lopez', email: 'ana@lago.mx' },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/usuarios')
  })

  test('email duplicado → mensaje específico sin insertar perfil', async () => {
    const f = fakeAdmin({
      createUser: { data: { user: null }, error: { message: 'exists', status: 422, code: 'email_exists' } },
    })
    const r = await crearUsuario(input)
    expect(r).toEqual({ ok: false, error: MSG_EMAIL_DUPLICADO })
    expect(callsOf(f.perfiles, 'insert')).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('falla del insert → borra el usuario de auth y devuelve el error genérico', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = fakeAdmin({ perfiles: fakeQuery({ error: { message: 'insert falló' } }) })
    const r = await crearUsuario(input)
    expect(r).toEqual({ ok: false, error: MSG_ERROR })
    expect(f.admin.deleteUser).toHaveBeenCalledWith('nuevo-id')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('datos inválidos no tocan el cliente admin', async () => {
    const r = await crearUsuario({ ...input, password: '123' })
    expect(r).toEqual({ ok: false, error: 'Mínimo 6 caracteres' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('rol super_admin falla la validación sin tocar el cliente admin', async () => {
    const r = await crearUsuario({ ...input, rol: 'super_admin' as never })
    expect(r).toEqual({ ok: false, error: 'Selecciona un rol' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})

describe('actualizarUsuario', () => {
  test('actualiza nombre y rol en perfiles', async () => {
    const perfiles = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ perfiles }) as never)
    const r = await actualizarUsuario('u9', { userName: 'ana lopez', rol: 'comite' })
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(perfiles, 'update')[0].args).toEqual([{ nombre: 'Ana Lopez', rol: 'comite' }])
    expect(callsOf(perfiles, 'eq')[0].args).toEqual(['id', 'u9'])
    expect(revalidatePath).toHaveBeenCalledWith('/usuarios')
  })

  test('no administrador no escribe', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith('comite'))
    const perfiles = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ perfiles }) as never)
    const r = await actualizarUsuario('u9', { userName: 'x', rol: 'comite' })
    expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(callsOf(perfiles, 'update')).toHaveLength(0)
  })

  test('no permite cambiar su propio rol', async () => {
    const perfiles = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ perfiles }) as never)
    const r = await actualizarUsuario('u1', { userName: 'x', rol: 'tesorero' })
    expect(r).toEqual({ ok: false, error: MSG_NO_AUTO_CAMBIAR_ROL })
    expect(callsOf(perfiles, 'update')).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('permite editar su propio nombre conservando el rol', async () => {
    const perfiles = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ perfiles }) as never)
    const r = await actualizarUsuario('u1', { userName: 'x', rol: 'administrador' })
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(perfiles, 'update')[0].args).toEqual([{ nombre: 'X', rol: 'administrador' }])
    expect(callsOf(perfiles, 'eq')[0].args).toEqual(['id', 'u1'])
  })
})

describe('cambiarEstadoUsuario', () => {
  test('no permite desactivarse a sí mismo', async () => {
    const perfiles = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ perfiles }) as never)
    const r = await cambiarEstadoUsuario('u1', false)
    expect(r).toEqual({ ok: false, error: MSG_NO_AUTO_DESACTIVAR })
    expect(callsOf(perfiles, 'update')).toHaveLength(0)
  })

  test('desactiva a otro usuario', async () => {
    const perfiles = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ perfiles }) as never)
    const r = await cambiarEstadoUsuario('u2', false)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(perfiles, 'update')[0].args).toEqual([{ activo: false }])
    expect(callsOf(perfiles, 'eq')[0].args).toEqual(['id', 'u2'])
    expect(revalidatePath).toHaveBeenCalledWith('/usuarios')
  })

  test('activa un usuario', async () => {
    const perfiles = fakeQuery({})
    vi.mocked(createClient).mockResolvedValue(fakeSupabase({ perfiles }) as never)
    await cambiarEstadoUsuario('u2', true)
    expect(callsOf(perfiles, 'update')[0].args).toEqual([{ activo: true }])
  })
})
