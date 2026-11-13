// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { AccessCoreError } from '@/lib/access-core/errores'

const autenticar = vi.fn()
const admin = vi.fn()
const llamar = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/app-auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/app-auth')>()),
  autenticarResidente: (r: Request) => autenticar(r),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin() }))
vi.mock('@/lib/supabase/env', () => ({ SUPABASE_URL: 'http://sb', SUPABASE_KEY: 'anon' }))
vi.mock('@/lib/access-core/http', () => ({ llamar: (...a: unknown[]) => llamar(...a) }))

import { POST } from './route'

const call = (id = '5', body: unknown = { botonId: 7 }) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  })

let aperturas: FakeQuery
let rpc: ReturnType<typeof vi.fn>

function escenario({
  moroso = false,
  recientes = 0,
  salida = 'sal-1' as string | null,
  instalacion = 'inst-1' as string | null,
  titular = 'tit-1' as string | null,
} = {}) {
  rpc = vi.fn().mockResolvedValue({ data: { moroso, botones: [{ id: 7, habilitado: !moroso }] }, error: null })
  autenticar.mockResolvedValue({
    ok: true,
    userId: 'u1',
    supabase: { ...fakeSupabase({ residentes: fakeQuery({ data: { nombre: 'Ana López' } }) }), rpc },
  })
  aperturas = fakeQuery({ count: recientes })
  admin.mockReturnValue(
    fakeSupabase({
      domicilios: fakeQuery({
        data: { fraccionamiento_id: 3, titular_id: titular, fraccionamientos: { instalacion_id: instalacion } },
      }),
      aperturas_remotas: aperturas,
      app_botones: fakeQuery({ data: { salida_id: salida } }),
    }),
  )
}

const auditado = () => (callsOf(aperturas, 'insert').at(-1)?.args[0] as { resultado: string } | undefined)?.resultado

describe('POST /api/app/domicilios/[id]/aperturas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    llamar.mockResolvedValue({ command_id: 'c', status: 'opened', reason: null, detail: null })
  })

  it('401 sin autenticación', async () => {
    autenticar.mockResolvedValue({ ok: false, status: 401 })
    expect((await call()).status).toBe(401)
    expect(llamar).not.toHaveBeenCalled()
  })

  it('404 domicilio ajeno y no llama a access-core', async () => {
    escenario()
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'No autorizado' } })
    expect((await call()).status).toBe(404)
    expect(llamar).not.toHaveBeenCalled()
    expect(admin).not.toHaveBeenCalled()
  })

  it('404 botón ajeno', async () => {
    escenario()
    expect((await call('5', { botonId: 99 })).status).toBe(404)
    expect(llamar).not.toHaveBeenCalled()
  })

  it('409 moroso con auditoría', async () => {
    escenario({ moroso: true })
    const res = await call()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Tu domicilio tiene adeudos' })
    expect(auditado()).toBe('moroso')
    expect(llamar).not.toHaveBeenCalled()
  })

  it('422 botón sin salida', async () => {
    escenario({ salida: null })
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Este acceso no está disponible' })
    expect(auditado()).toBe('no_disponible')
  })

  it('422 sin titular o sin instalación', async () => {
    escenario({ titular: null })
    expect((await call()).status).toBe(422)
    escenario({ instalacion: null })
    expect((await call()).status).toBe(422)
    expect(llamar).not.toHaveBeenCalled()
  })

  it('429 en la 11.ª apertura en 60 s', async () => {
    escenario({ recientes: 10 })
    const res = await call()
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Demasiados intentos, espera un momento' })
    expect(auditado()).toBe('limite')
    expect(llamar).not.toHaveBeenCalled()
  })

  it('502 si access-core falla, con auditoría error', async () => {
    escenario()
    llamar.mockRejectedValue(new AccessCoreError(502, 'bad_gateway', 'x'))
    const res = await call()
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'No se pudo abrir, intenta de nuevo' })
    expect(auditado()).toBe('error')
  })

  it('access-core 404 ⇒ 422; 429 ⇒ 429', async () => {
    escenario()
    llamar.mockRejectedValue(new AccessCoreError(404, 'not_found', 'x'))
    expect((await call()).status).toBe(422)
    escenario()
    llamar.mockRejectedValue(new AccessCoreError(429, 'rate', 'x'))
    expect((await call()).status).toBe(429)
  })

  it('200 opened con titular como holder e Idempotency-Key', async () => {
    escenario()
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'opened' })
    const [metodo, ruta, opciones] = llamar.mock.calls[0]
    expect(metodo).toBe('POST')
    expect(ruta).toBe('/installations/inst-1/outputs/sal-1/open')
    expect(opciones.cuerpo).toEqual({ holder_id: 'tit-1', requested_by: 'App · Ana López' })
    expect(opciones.idempotencyKey).toEqual(expect.any(String))
    expect(auditado()).toBe('opened')
  })

  it('200 denied del panel', async () => {
    escenario()
    llamar.mockResolvedValue({ command_id: 'c', status: 'denied', reason: 3, detail: null })
    const res = await call()
    expect(await res.json()).toEqual({ status: 'denied' })
    expect(auditado()).toBe('denied')
  })

  it('200 opened con la respuesta real del panel (reason numérico y detail de texto)', async () => {
    escenario()
    llamar.mockResolvedValue({ command_id: 'c', status: 'opened', reason: 0, detail: 'Abierta' })
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'opened' })
    const fila = callsOf(aperturas, 'insert').at(-1)?.args[0] as { resultado: string; detalle: string }
    expect(fila).toMatchObject({ resultado: 'opened', detalle: 'Abierta (motivo 0)' })
  })

  it('denied con reason numérico y sin detail guarda el motivo', async () => {
    escenario()
    llamar.mockResolvedValue({ command_id: 'c', status: 'denied', reason: 3, detail: null })
    const res = await call()
    expect(await res.json()).toEqual({ status: 'denied' })
    const fila = callsOf(aperturas, 'insert').at(-1)?.args[0] as { detalle: string }
    expect(fila.detalle).toBe('motivo 3')
  })

  it('si falla el registro de auditoría, la respuesta de la apertura no cambia', async () => {
    escenario()
    aperturas.insert = vi.fn(() => {
      throw new Error('fallo de auditoría')
    }) as never
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'opened' })
  })

  it('400 con cuerpo inválido', async () => {
    escenario()
    expect((await call('5', { botonId: 'a' })).status).toBe(400)
  })
})
