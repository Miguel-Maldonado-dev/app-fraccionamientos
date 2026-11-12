import { afterEach, describe, expect, test, vi } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { altaUsuario } from './alta'

const datos = {
  fraccionamientoId: 7,
  rol: 'tesorero' as const,
  nombre: 'Ana Lopez',
  email: 'ana@lago.mx',
  password: '123456',
}

function fakeAdmin({
  createUser = { data: { user: { id: 'nuevo-id' } }, error: null } as unknown,
  perfiles = fakeQuery({}) as FakeQuery,
  deleteUser = { data: { user: null }, error: null } as unknown,
} = {}) {
  const admin = {
    createUser: vi.fn().mockResolvedValue(createUser),
    deleteUser: vi.fn().mockResolvedValue(deleteUser),
  }
  const client = fakeSupabase({ perfiles }, { auth: { admin } })
  return { client: client as never, admin, perfiles, from: client.from }
}

afterEach(() => vi.restoreAllMocks())

describe('altaUsuario', () => {
  test('crea el usuario en auth y luego el perfil con el fraccionamiento indicado', async () => {
    const f = fakeAdmin()
    const r = await altaUsuario(f.client, datos)
    expect(r).toEqual({ ok: true, id: 'nuevo-id' })
    expect(f.admin.createUser).toHaveBeenCalledWith({
      email: 'ana@lago.mx',
      password: '123456',
      email_confirm: true,
    })
    expect(f.from).toHaveBeenCalledWith('perfiles')
    expect(callsOf(f.perfiles, 'insert')[0].args).toEqual([
      { id: 'nuevo-id', fraccionamiento_id: 7, rol: 'tesorero', nombre: 'Ana Lopez', email: 'ana@lago.mx' },
    ])
    expect(f.admin.deleteUser).not.toHaveBeenCalled()
  })

  test('email duplicado (code email_exists) → email_duplicado sin insertar perfil', async () => {
    const f = fakeAdmin({
      createUser: { data: { user: null }, error: { message: 'exists', status: 422, code: 'email_exists' } },
    })
    const r = await altaUsuario(f.client, datos)
    expect(r).toEqual({ ok: false, motivo: 'email_duplicado' })
    expect(f.from).not.toHaveBeenCalled()
    expect(callsOf(f.perfiles, 'insert')).toHaveLength(0)
  })

  test('email duplicado (solo status 422) → email_duplicado', async () => {
    const f = fakeAdmin({
      createUser: { data: { user: null }, error: { message: 'exists', status: 422, code: undefined } },
    })
    const r = await altaUsuario(f.client, datos)
    expect(r).toEqual({ ok: false, motivo: 'email_duplicado' })
    expect(f.from).not.toHaveBeenCalled()
  })

  test('422 con code weak_password → error, no email_duplicado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = fakeAdmin({
      createUser: { data: { user: null }, error: { message: 'weak', status: 422, code: 'weak_password' } },
    })
    const r = await altaUsuario(f.client, datos)
    expect(r).toEqual({ ok: false, motivo: 'error' })
    expect(f.from).not.toHaveBeenCalled()
  })

  test('otro error de createUser → error sin insertar perfil', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = fakeAdmin({
      createUser: { data: { user: null }, error: { message: 'boom', status: 500, code: 'unexpected_failure' } },
    })
    const r = await altaUsuario(f.client, datos)
    expect(r).toEqual({ ok: false, motivo: 'error' })
    expect(f.from).not.toHaveBeenCalled()
  })

  test('si falla el insert del perfil, borra el usuario de auth y devuelve error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = fakeAdmin({ perfiles: fakeQuery({ error: { message: 'insert falló' } }) })
    const r = await altaUsuario(f.client, datos)
    expect(r).toEqual({ ok: false, motivo: 'error' })
    expect(f.admin.deleteUser).toHaveBeenCalledWith('nuevo-id')
  })

  test('si falla el insert y también deleteUser, registra el error y devuelve error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const f = fakeAdmin({
      perfiles: fakeQuery({ error: { message: 'insert falló' } }),
      deleteUser: { data: { user: null }, error: { message: 'delete falló', status: 500 } },
    })
    const r = await altaUsuario(f.client, datos)
    expect(r).toEqual({ ok: false, motivo: 'error' })
    expect(f.admin.deleteUser).toHaveBeenCalledWith('nuevo-id')
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('nuevo-id'), expect.anything())
  })
})
