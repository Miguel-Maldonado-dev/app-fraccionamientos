import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { darAccesoApp, desligarDispositivo, quitarAccesoApp, restablecerPasswordResidente } from './cuentas-actions'
import { MSG_CUENTA_EN_OTRO_FRACCIONAMIENTO, MSG_RESIDENTE_NO_ENCONTRADO, MSG_TELEFONO_YA_EN_DOMICILIO } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn() }))

const tesorero = { id: 't1', email: 't@b.c', userName: 'Tere', roleName: 'tesorero', isActive: true }
const residente = { id: 5, domicilio_id: 9, fraccionamiento_id: 1, user_id: null as string | null }

let auth: {
  createUser: ReturnType<typeof vi.fn>
  deleteUser: ReturnType<typeof vi.fn>
  updateUserById: ReturnType<typeof vi.fn>
}

function usuario(res: unknown, conCuenta = 0, max = 2) {
  const s = fakeSupabase({
    residentes: fakeQuery({ data: res }),
    fraccionamientos: fakeQuery({ data: { max_residentes_app: max } }),
  })
  s.rpc.mockResolvedValue({ data: conCuenta, error: null })
  vi.mocked(createClient).mockResolvedValue(s as never)
  return s
}

function admin(tables: Record<string, FakeQuery | FakeQuery[]>) {
  // Por defecto el domicilio no tiene tipo de cuota con medio teléfono.
  const s = fakeSupabase({ domicilio_concepto: fakeQuery({}), ...tables }, { auth: { admin: auth } })
  vi.mocked(createAdminClient).mockReturnValue(s as never)
  return s
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(tesorero as never)
  auth = {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'nuevo' } }, error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }
})

describe('darAccesoApp', () => {
  test('crea la cuenta y vincula al residente con el teléfono normalizado', async () => {
    usuario(residente)
    const upd = fakeQuery({})
    admin({ cuentas_residente: [fakeQuery({}), fakeQuery({})], residentes: [fakeQuery({ data: [] }), upd] })
    const r = await darAccesoApp(5, { telefono: '+52 33 1234 5678', password: 'secreta123' })
    expect(r).toEqual({ ok: true, data: { cuentaCreada: true } })
    expect(callsOf(upd, 'update')[0].args).toEqual([{ user_id: 'nuevo', telefono: '3312345678' }])
    expect(callsOf(upd, 'eq')[0].args).toEqual(['id', 5])
  })

  test('cuenta existente: vincula sin contraseña', async () => {
    usuario(residente)
    admin({
      cuentas_residente: fakeQuery({ data: { user_id: 'u1', activo: true } }),
      residentes: [fakeQuery({ data: [] }), fakeQuery({})],
    })
    const r = await darAccesoApp(5, { telefono: '3312345678' })
    expect(r).toEqual({ ok: true, data: { cuentaCreada: false } })
    expect(auth.createUser).not.toHaveBeenCalled()
  })

  test('con medio teléfono habilitado registra el teléfono en telefonos_acceso', async () => {
    usuario(residente)
    const ta = [fakeQuery({ data: [] }), fakeQuery({})]
    admin({
      cuentas_residente: fakeQuery({ data: { user_id: 'u1', activo: true } }),
      residentes: [fakeQuery({ data: [] }), fakeQuery({})],
      domicilio_concepto: fakeQuery({ data: { concepto_id: 3 } }),
      concepto_pago_acceso: fakeQuery({ data: { medios: ['telefono'] } }),
      telefonos_acceso: ta,
    })
    const r = await darAccesoApp(5, { telefono: '3312345678' })
    expect(r.ok).toBe(true)
    expect(callsOf(ta[1], 'insert')[0].args).toEqual([
      { domicilio_id: 9, telefono: '3312345678', fraccionamiento_id: 1, residente_id: 5 },
    ])
  })

  test('máximo alcanzado ⇒ fail sin crear cuenta', async () => {
    usuario(residente, 2, 2)
    admin({})
    const r = await darAccesoApp(5, { telefono: '3312345678', password: 'secreta123' })
    expect(r).toEqual({ ok: false, error: 'Este domicilio ya tiene el máximo de 2 residentes con acceso a la app' })
    expect(auth.createUser).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('residente no visible (otro fraccionamiento) ⇒ no encontrado sin service-role', async () => {
    usuario(null)
    const r = await darAccesoApp(5, { telefono: '3312345678', password: 'secreta123' })
    expect(r).toEqual({ ok: false, error: MSG_RESIDENTE_NO_ENCONTRADO })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('teléfono ya vinculado a otro residente del domicilio', async () => {
    usuario(residente)
    const upd = fakeQuery({})
    admin({
      cuentas_residente: fakeQuery({ data: { user_id: 'u1', activo: true } }),
      residentes: [fakeQuery({ data: [{ id: 6 }] }), upd],
    })
    const r = await darAccesoApp(5, { telefono: '3312345678' })
    expect(r).toEqual({ ok: false, error: MSG_TELEFONO_YA_EN_DOMICILIO })
    expect(callsOf(upd, 'update')).toHaveLength(0)
  })

  test('teléfono inválido', async () => {
    const r = await darAccesoApp(5, { telefono: '331234567' })
    expect(r.ok).toBe(false)
    expect(createClient).not.toHaveBeenCalled()
  })

  test('rol sin permiso', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...tesorero, roleName: 'vigilante' } as never)
    const r = await darAccesoApp(5, { telefono: '3312345678' })
    expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
  })
})

describe('quitarAccesoApp', () => {
  test('último domicilio ⇒ quita user_id y banea', async () => {
    usuario({ ...residente, user_id: 'u1' })
    const upd = fakeQuery({})
    const cuentas = fakeQuery({})
    admin({ residentes: [upd, fakeQuery({ count: 0 })], cuentas_residente: cuentas })
    const r = await quitarAccesoApp(5)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(upd, 'update')[0].args).toEqual([{ user_id: null }])
    expect(auth.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: '876000h' })
  })

  test('con medio teléfono habilitado borra el teléfono del residente', async () => {
    usuario({ ...residente, user_id: 'u1', telefono: '3312345678' })
    const ta = fakeQuery({})
    admin({
      residentes: [fakeQuery({}), fakeQuery({ count: 1 })],
      cuentas_residente: fakeQuery({}),
      domicilio_concepto: fakeQuery({ data: { concepto_id: 3 } }),
      concepto_pago_acceso: fakeQuery({ data: { medios: ['telefono'] } }),
      telefonos_acceso: ta,
    })
    const r = await quitarAccesoApp(5)
    expect(r.ok).toBe(true)
    expect(callsOf(ta, 'delete')).toHaveLength(1)
    expect(callsOf(ta, 'eq').map((c) => c.args)).toEqual([['domicilio_id', 9], ['telefono', '3312345678'], ['residente_id', 5]])
  })

  test('con otro domicilio restante ⇒ sin ban', async () => {
    usuario({ ...residente, user_id: 'u1' })
    admin({ residentes: [fakeQuery({}), fakeQuery({ count: 1 })], cuentas_residente: fakeQuery({}) })
    const r = await quitarAccesoApp(5)
    expect(r.ok).toBe(true)
    expect(auth.updateUserById).not.toHaveBeenCalled()
  })

  test('residente no visible ⇒ no encontrado sin service-role', async () => {
    usuario(null)
    const r = await quitarAccesoApp(5)
    expect(r).toEqual({ ok: false, error: MSG_RESIDENTE_NO_ENCONTRADO })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})

describe('restablecerPasswordResidente', () => {
  test('cambia la contraseña de la cuenta del residente', async () => {
    usuario({ ...residente, user_id: 'u1' })
    admin({ residentes: fakeQuery({ data: [{ fraccionamiento_id: 1 }, { fraccionamiento_id: 1 }] }) })
    const r = await restablecerPasswordResidente(5, 'secreta123')
    expect(r).toEqual({ ok: true, data: undefined })
    expect(auth.updateUserById).toHaveBeenCalledWith('u1', { password: 'secreta123' })
  })

  test('cuenta vinculada también en otro fraccionamiento ⇒ fail sin cambiar la contraseña', async () => {
    usuario({ ...residente, user_id: 'u1' })
    admin({ residentes: fakeQuery({ data: [{ fraccionamiento_id: 1 }, { fraccionamiento_id: 2 }] }) })
    const r = await restablecerPasswordResidente(5, 'secreta123')
    expect(r).toEqual({ ok: false, error: MSG_CUENTA_EN_OTRO_FRACCIONAMIENTO })
    expect(auth.updateUserById).not.toHaveBeenCalled()
  })
})

describe('desligarDispositivo', () => {
  const administrador = { ...tesorero, roleName: 'administrador' }

  test('borra la fila del dispositivo de la cuenta', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(administrador as never)
    usuario({ ...residente, user_id: 'u1' })
    const disp = fakeQuery({})
    admin({ dispositivos_residente: disp })
    const r = await desligarDispositivo(5)
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(disp, 'delete')).toHaveLength(1)
    expect(callsOf(disp, 'eq')[0].args).toEqual(['user_id', 'u1'])
  })

  test('residente no visible ⇒ error sin tocar service-role', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(administrador as never)
    usuario(null)
    const r = await desligarDispositivo(5)
    expect(r).toEqual({ ok: false, error: MSG_RESIDENTE_NO_ENCONTRADO })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('sin cuenta ⇒ error sin tocar service-role', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(administrador as never)
    usuario(residente)
    const r = await desligarDispositivo(5)
    expect(r.ok).toBe(false)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('el tesorero no puede', async () => {
    usuario({ ...residente, user_id: 'u1' })
    const r = await desligarDispositivo(5)
    expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
