// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeQuery, fakeSupabase } from '@/test/fake-query'

const createClient = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a: unknown[]) => createClient(...a) }))
const admin = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin() }))
vi.mock('@/lib/supabase/env', () => ({ SUPABASE_URL: 'http://sb', SUPABASE_KEY: 'anon' }))

import { callsOf, type FakeQuery } from '@/test/fake-query'
import { autenticarResidente, requestedBy, respuestaAuth } from './app-auth'

const DEV = 'dispositivo-1'
const req = (auth?: string, device: string | null = DEV, nombre?: string) =>
  new Request('http://x', {
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      ...(device ? { 'X-Device-Id': device } : {}),
      ...(nombre ? { 'X-Device-Name': nombre } : {}),
    },
  })
const dispositivos = (...qs: FakeQuery[]) => {
  admin.mockReturnValue(fakeSupabase({ dispositivos_residente: qs }))
  return qs
}
const cliente = (user: unknown, cuenta: unknown) =>
  fakeSupabase(
    { cuentas_residente: fakeQuery({ data: cuenta }) },
    { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'bad' } }) } },
  )

describe('autenticarResidente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 sin header', async () => {
    expect(await autenticarResidente(req())).toEqual({ ok: false, status: 401 })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('401 con token inválido', async () => {
    createClient.mockReturnValue(cliente(null, null))
    expect(await autenticarResidente(req('Bearer malo'))).toEqual({ ok: false, status: 401 })
  })

  it('401 sin cuenta de residente activa', async () => {
    createClient.mockReturnValue(cliente({ id: 'u1' }, null))
    expect((await autenticarResidente(req('Bearer t'))).ok).toBe(false)
    createClient.mockReturnValue(cliente({ id: 'u1' }, { activo: false }))
    expect((await autenticarResidente(req('Bearer t'))).ok).toBe(false)
  })

  it('400 sin X-Device-Id', async () => {
    expect(await autenticarResidente(req('Bearer t', null))).toEqual({ ok: false, status: 400 })
    expect(await autenticarResidente(req('Bearer t', 'corto'))).toEqual({ ok: false, status: 400 })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('primer uso liga el dispositivo con su nombre recortado', async () => {
    createClient.mockReturnValue(cliente({ id: 'u1' }, { activo: true }))
    const [leer, insertar] = dispositivos(fakeQuery({ data: null }), fakeQuery())
    const r = await autenticarResidente(req('Bearer t', DEV, 'iPhone ' + 'x'.repeat(100)))
    expect(r.ok).toBe(true)
    expect(callsOf(leer, 'eq')[0].args).toEqual(['user_id', 'u1'])
    const fila = callsOf(insertar, 'insert')[0].args[0] as { user_id: string; device_id: string; nombre: string }
    expect(fila).toMatchObject({ user_id: 'u1', device_id: DEV })
    expect(fila.nombre).toHaveLength(80)
  })

  it('mismo dispositivo ⇒ ok; otro ⇒ 403 otro_dispositivo', async () => {
    createClient.mockReturnValue(cliente({ id: 'u1' }, { activo: true }))
    dispositivos(fakeQuery({ data: { device_id: DEV } }))
    expect((await autenticarResidente(req('Bearer t'))).ok).toBe(true)
    dispositivos(fakeQuery({ data: { device_id: 'otro-dispositivo' } }))
    expect(await autenticarResidente(req('Bearer t'))).toEqual({ ok: false, status: 403, codigo: 'otro_dispositivo' })
  })

  it('carrera al ligar: compara con el que quedó', async () => {
    createClient.mockReturnValue(cliente({ id: 'u1' }, { activo: true }))
    dispositivos(
      fakeQuery({ data: null }),
      fakeQuery({ error: { code: '23505' } }),
      fakeQuery({ data: { device_id: 'otro-dispositivo' } }),
    )
    expect(await autenticarResidente(req('Bearer t'))).toMatchObject({ status: 403 })
  })

  it('ok con cuenta activa y cliente con el token', async () => {
    dispositivos(fakeQuery({ data: { device_id: DEV } }))
    const c = cliente({ id: 'u1' }, { activo: true })
    createClient.mockReturnValue(c)
    const r = await autenticarResidente(req('Bearer tok'))
    expect(r).toMatchObject({ ok: true, userId: 'u1' })
    expect(createClient.mock.calls[0][2].global.headers.Authorization).toBe('Bearer tok')
    expect(c.auth).toBeDefined()
  })
})

describe('respuestaAuth', () => {
  it('JSON exacto por estado', async () => {
    const r403 = respuestaAuth({ ok: false, status: 403, codigo: 'otro_dispositivo' })
    expect(r403.status).toBe(403)
    expect(await r403.json()).toEqual({
      error: 'Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue.',
      codigo: 'otro_dispositivo',
    })
    expect(respuestaAuth({ ok: false, status: 400 }).status).toBe(400)
    expect(respuestaAuth({ ok: false, status: 401 }).status).toBe(401)
  })
})

describe('requestedBy', () => {
  it('limpia control y recorta a 120', () => {
    expect(requestedBy('Ana\nLópez')).toBe('App · Ana López')
    expect(requestedBy('x'.repeat(300)).length).toBe(120)
    expect(requestedBy(null)).toBe('App · Residente')
  })
})
