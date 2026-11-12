// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { crearTarjeta, borrarTarjeta, editarTarjeta } from './tarjetas'
import { borrarTitular, crearTitular, editarTitular, fijarPin, generarPin, quitarPin } from './titulares'

const fetchMock = vi.fn()
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const B = 'https://ac.test/api/v1/installations/i1'

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('ACCESS_CORE_API_URL', 'https://ac.test/api/v1')
  vi.stubEnv('ACCESS_CORE_API_KEY', 'acc_x')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('titulares', () => {
  it('crea, edita y borra con Idempotency-Key', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'h1' }, revision: 1 }, 201))
    expect(await crearTitular('i1', { kind: 'domicilio', name: 'Casa 1' }, 'k1')).toEqual({ id: 'h1' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${B}/holders`)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe('k1')

    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'h1' }, revision: 2 }))
    await editarTitular('i1', 'h1', { name: 'Casa 2' }, 'k2')
    expect(fetchMock.mock.calls[1][0]).toBe(`${B}/holders/h1`)
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ name: 'Casa 2' }))

    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'h1' }, revision: 3 }))
    await borrarTitular('i1', 'h1', 'k3')
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
    expect(fetchMock.mock.calls[2][1].headers['Idempotency-Key']).toBe('k3')
  })

  it('generarPin manda { generate: true } sin Idempotency-Key y devuelve el pin', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { pin: '123456' }, revision: 4 }))
    expect(await generarPin('i1', 'h1')).toBe('123456')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${B}/holders/h1/pin`)
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ generate: true }))
    expect(init.headers['Idempotency-Key']).toBeUndefined()
  })

  it('fijarPin manda { pin } y quitarPin hace DELETE, ambos sin Idempotency-Key', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { has_pin: true }, revision: 5 }))
    await fijarPin('i1', 'h1', '1234')
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ pin: '1234' }))
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeUndefined()
    fetchMock.mockResolvedValueOnce(ok({ data: { has_pin: false }, revision: 6 }))
    await quitarPin('i1', 'h1')
    expect(fetchMock.mock.calls[1][0]).toBe(`${B}/holders/h1/pin`)
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
    expect(fetchMock.mock.calls[1][1].headers['Idempotency-Key']).toBeUndefined()
  })
})

describe('tarjetas', () => {
  it('crea, edita y borra', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 't1' }, revision: 1 }, 201))
    expect(await crearTarjeta('i1', { card_code: 123, holder_id: 'h1', description: 'd' }, 'k1')).toEqual({ id: 't1' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${B}/cards`)
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ card_code: 123, holder_id: 'h1', description: 'd' }))
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 't1' }, revision: 2 }))
    await editarTarjeta('i1', 't1', { description: 'e' }, 'k2')
    expect(fetchMock.mock.calls[1][0]).toBe(`${B}/cards/t1`)
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 't1' }, revision: 3 }))
    await borrarTarjeta('i1', 't1', 'k3')
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
  })
})
