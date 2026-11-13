// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const autenticar = vi.fn()
const agregar = vi.fn()
const listar = vi.fn()
const quitar = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/env', () => ({ SUPABASE_URL: 'http://sb', SUPABASE_KEY: 'anon' }))
vi.mock('@/lib/app-auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/app-auth')>()),
  autenticarResidente: (r: Request) => autenticar(r),
}))
vi.mock('@/features/residentes/residentes-principal', () => ({
  MSG_DOMICILIO_NO_ENCONTRADO: 'Domicilio no encontrado',
  MSG_RESIDENTE_NO_ENCONTRADO_APP: 'Residente no encontrado',
  agregarResidentePorPrincipal: (...a: unknown[]) => agregar(...a),
  listarResidentesDomicilio: (...a: unknown[]) => listar(...a),
  quitarResidentePorPrincipal: (...a: unknown[]) => quitar(...a),
}))

import { GET, POST } from './route'
import { DELETE } from './[residenteId]/route'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body: string) => POST(new Request('http://x', { method: 'POST', body }), ctx('9'))

describe('/api/app/domicilios/[id]/residentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autenticar.mockResolvedValue({ ok: true, userId: 'u', supabase: {} })
  })

  it('401 sin token', async () => {
    autenticar.mockResolvedValue({ ok: false, status: 401 })
    expect((await GET(new Request('http://x'), ctx('9'))).status).toBe(401)
    expect(listar).not.toHaveBeenCalled()
  })

  it('GET devuelve la lista', async () => {
    listar.mockResolvedValue({ ok: true, data: [{ id: 1 }] })
    const res = await GET(new Request('http://x'), ctx('9'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1 }])
  })

  it('GET id inválido ⇒ 404', async () => {
    expect((await GET(new Request('http://x'), ctx('abc'))).status).toBe(404)
  })

  it('POST cuerpo inválido ⇒ 400', async () => {
    expect((await post('no-json')).status).toBe(400)
  })

  it('POST 403 si no es principal', async () => {
    agregar.mockResolvedValue({ ok: false, status: 403, error: 'x' })
    const res = await post('{"nombre":"B","telefono":"5512345678"}')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'x' })
  })

  it('POST 201', async () => {
    agregar.mockResolvedValue({ ok: true, data: { id: 5, cuentaCreada: false } })
    const res = await post('{"nombre":"B","telefono":"5512345678"}')
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 5, cuentaCreada: false })
    expect(agregar).toHaveBeenCalledWith({}, 'u', 9, { nombre: 'B', telefono: '5512345678' })
  })

  it('DELETE 204 / 422', async () => {
    quitar.mockResolvedValueOnce({ ok: true, data: null })
    const d = (rid: string) => DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ id: '9', residenteId: rid }) })
    expect((await d('2')).status).toBe(204)
    quitar.mockResolvedValueOnce({ ok: false, status: 422, error: 'No puedes quitarte a ti mismo' })
    expect((await d('1')).status).toBe(422)
    expect(quitar).toHaveBeenLastCalledWith({}, 'u', 9, 1)
  })

  it('500 si falla inesperadamente', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    listar.mockRejectedValue(new Error('boom'))
    expect((await GET(new Request('http://x'), ctx('9'))).status).toBe(500)
  })
})
