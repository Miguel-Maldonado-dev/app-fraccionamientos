// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AccessCoreError, AccessCoreNoConfigurado } from './errores'
import { llamar } from './http'

function respuesta(cuerpo: unknown, init: ResponseInit = {}) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('llamar', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('ACCESS_CORE_API_URL', 'https://ac.test/api/v1/')
    vi.stubEnv('ACCESS_CORE_API_KEY', 'acc_x')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('manda autorización, content-type e idempotency-key a la ruta correcta', async () => {
    fetchMock.mockResolvedValue(respuesta({ data: { id: '1' }, revision: 3 }, { status: 201 }))
    await llamar('POST', '/installations/abc/holders', { cuerpo: { name: 'x' }, idempotencyKey: 'k1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ac.test/api/v1/installations/abc/holders')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer acc_x')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.headers['Idempotency-Key']).toBe('k1')
    expect(init.body).toBe(JSON.stringify({ name: 'x' }))
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('no manda Idempotency-Key si no se pasa', async () => {
    fetchMock.mockResolvedValue(respuesta({ data: [] }))
    await llamar('GET', '/installations')
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeUndefined()
  })

  it('usa la URL por defecto', async () => {
    vi.stubEnv('ACCESS_CORE_API_URL', '')
    fetchMock.mockResolvedValue(respuesta({ data: [] }))
    await llamar('GET', '/installations')
    expect(fetchMock.mock.calls[0][0]).toBe('https://access-core-cloud.vercel.app/api/v1/installations')
  })

  it('sin llave lanza AccessCoreNoConfigurado sin llamar a fetch', async () => {
    vi.stubEnv('ACCESS_CORE_API_KEY', '')
    await expect(llamar('GET', '/installations')).rejects.toBeInstanceOf(AccessCoreNoConfigurado)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('429 con Retry-After es reintentable', async () => {
    fetchMock.mockResolvedValue(
      respuesta({ code: 'rate_limited', message: 'Demasiadas peticiones' }, { status: 429, headers: { 'Retry-After': '7' } }),
    )
    const error = await llamar('GET', '/installations').catch((e) => e) as AccessCoreError
    expect(error).toBeInstanceOf(AccessCoreError)
    expect(error).toMatchObject({ status: 429, code: 'rate_limited', retryAfter: 7, reintentable: true })
    expect(error.message).toBe('Demasiadas peticiones')
  })

  it.each([
    [500, true],
    [502, true],
    [503, true],
    [504, true],
    [400, false],
    [401, false],
    [404, false],
    [409, false],
    [422, false],
  ])('status %i reintentable=%s', async (status, reintentable) => {
    fetchMock.mockResolvedValue(respuesta({ code: 'x', message: 'm' }, { status }))
    const error = await llamar('GET', '/x').catch((e) => e) as AccessCoreError
    expect(error.reintentable).toBe(reintentable)
  })

  it('error de red es status 0 y reintentable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const error = await llamar('GET', '/x').catch((e) => e) as AccessCoreError
    expect(error).toBeInstanceOf(AccessCoreError)
    expect(error).toMatchObject({ status: 0, reintentable: true })
  })

  it('error con cuerpo no JSON conserva el status', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 502 }))
    const error = await llamar('GET', '/x').catch((e) => e) as AccessCoreError
    expect(error).toMatchObject({ status: 502, reintentable: true })
  })

  it('desenvuelve {data, revision}', async () => {
    fetchMock.mockResolvedValue(respuesta({ data: { a: 1 }, revision: 3 }))
    expect(await llamar('GET', '/x')).toEqual({ a: 1 })
  })

  it('204 devuelve undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    expect(await llamar('DELETE', '/x')).toBeUndefined()
  })
})
