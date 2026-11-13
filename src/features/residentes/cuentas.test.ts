import { beforeEach, describe, expect, test, vi } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { desactivarSiSinDomicilios, obtenerOCrearCuenta, restablecerPassword } from './cuentas'

function authAdmin() {
  return {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'nuevo' } }, error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }
}

let auth: ReturnType<typeof authAdmin>
function admin(tables: Record<string, FakeQuery | FakeQuery[]>) {
  return fakeSupabase(tables, { auth: { admin: auth } }) as never
}

beforeEach(() => {
  auth = authAdmin()
})

describe('obtenerOCrearCuenta', () => {
  test('cuenta existente activa: no crea ni exige contraseña', async () => {
    const q = fakeQuery({ data: { user_id: 'u1', activo: true } })
    const r = await obtenerOCrearCuenta(admin({ cuentas_residente: q }), { telefono: '3312345678' })
    expect(r).toEqual({ ok: true, userId: 'u1', creada: false })
    expect(auth.createUser).not.toHaveBeenCalled()
    expect(auth.updateUserById).not.toHaveBeenCalled()
  })

  test('cuenta existente inactiva: la reactiva y quita el ban', async () => {
    const buscar = fakeQuery({ data: { user_id: 'u1', activo: false } })
    const upd = fakeQuery({})
    const r = await obtenerOCrearCuenta(admin({ cuentas_residente: [buscar, upd] }), { telefono: '3312345678' })
    expect(r).toEqual({ ok: true, userId: 'u1', creada: false })
    expect(auth.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: 'none' })
    expect(callsOf(upd, 'update')[0].args).toEqual([{ activo: true }])
  })

  test('nueva sin contraseña ⇒ password_requerida', async () => {
    const r = await obtenerOCrearCuenta(admin({ cuentas_residente: fakeQuery({}) }), { telefono: '3312345678' })
    expect(r).toEqual({ ok: false, motivo: 'password_requerida' })
    expect(auth.createUser).not.toHaveBeenCalled()
  })

  test('nueva con contraseña corta ⇒ password_invalida', async () => {
    const r = await obtenerOCrearCuenta(admin({ cuentas_residente: fakeQuery({}) }), {
      telefono: '3312345678',
      password: '1234567',
    })
    expect(r).toEqual({ ok: false, motivo: 'password_invalida' })
  })

  test('nueva: crea con correo sintético y registra la cuenta', async () => {
    const ins = fakeQuery({})
    const r = await obtenerOCrearCuenta(admin({ cuentas_residente: [fakeQuery({}), ins] }), {
      telefono: '3312345678',
      password: 'secreta123',
    })
    expect(r).toEqual({ ok: true, userId: 'nuevo', creada: true })
    expect(auth.createUser).toHaveBeenCalledWith({
      email: '3312345678@auth.internal',
      password: 'secreta123',
      email_confirm: true,
    })
    expect(callsOf(ins, 'insert')[0].args).toEqual([{ user_id: 'nuevo', telefono: '3312345678' }])
  })

  test('falla el insert ⇒ borra el usuario de auth', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ins = fakeQuery({ error: { message: 'x' } })
    const r = await obtenerOCrearCuenta(admin({ cuentas_residente: [fakeQuery({}), ins] }), {
      telefono: '3312345678',
      password: 'secreta123',
    })
    expect(r).toEqual({ ok: false, motivo: 'error' })
    expect(auth.deleteUser).toHaveBeenCalledWith('nuevo')
  })
})

describe('desactivarSiSinDomicilios', () => {
  test('sin domicilios restantes ⇒ desactiva y banea', async () => {
    const cuentas = fakeQuery({})
    await desactivarSiSinDomicilios(admin({ residentes: fakeQuery({ count: 0 }), cuentas_residente: cuentas }), 'u1')
    expect(callsOf(cuentas, 'update')[0].args).toEqual([{ activo: false }])
    expect(auth.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: '876000h' })
  })

  test('con otro domicilio ⇒ no banea', async () => {
    const cuentas = fakeQuery({})
    await desactivarSiSinDomicilios(admin({ residentes: fakeQuery({ count: 1 }), cuentas_residente: cuentas }), 'u1')
    expect(callsOf(cuentas, 'update')).toHaveLength(0)
    expect(auth.updateUserById).not.toHaveBeenCalled()
  })
})

describe('restablecerPassword', () => {
  test('rechaza menos de 8 caracteres', async () => {
    const r = await restablecerPassword(admin({}), 'u1', 'corta')
    expect(r).toEqual({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' })
    expect(auth.updateUserById).not.toHaveBeenCalled()
  })

  test('cambia la contraseña', async () => {
    const r = await restablecerPassword(admin({}), 'u1', 'secreta123')
    expect(r).toEqual({ ok: true, data: undefined })
    expect(auth.updateUserById).toHaveBeenCalledWith('u1', { password: 'secreta123' })
  })
})
