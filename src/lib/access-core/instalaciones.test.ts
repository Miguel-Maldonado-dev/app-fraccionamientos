// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { listarInstalaciones, listarPaneles, listarSalidas, obtenerInstalacion } from './instalaciones'
import { asignarTitulares, listarPerfiles } from './perfiles'

const fetchMock = vi.fn()
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

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

describe('instalaciones', () => {
  it('lista y obtiene instalaciones', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: 'i1', name: 'A', revision: 1 }] }))
    expect(await listarInstalaciones()).toEqual([{ id: 'i1', name: 'A', revision: 1 }])
    expect(fetchMock.mock.calls[0][0]).toBe('https://ac.test/api/v1/installations')
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'i1', name: 'A', revision: 1 } }))
    expect((await obtenerInstalacion('i1')).id).toBe('i1')
    expect(fetchMock.mock.calls[1][0]).toBe('https://ac.test/api/v1/installations/i1')
  })

  it('lista paneles y salidas', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: 'p1' }] }))
    expect(await listarPaneles('i1')).toEqual([{ id: 'p1' }])
    expect(fetchMock.mock.calls[0][0]).toBe('https://ac.test/api/v1/installations/i1/panels')
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: 's1' }] }))
    expect(await listarSalidas('i1')).toEqual([{ id: 's1' }])
    expect(fetchMock.mock.calls[1][0]).toBe('https://ac.test/api/v1/installations/i1/outputs')
  })
})

describe('perfiles', () => {
  it('lista perfiles y asigna titulares con idempotencia', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: 'f1', name: 'Residentes', holder_ids: [] }] }))
    expect((await listarPerfiles('i1'))[0].name).toBe('Residentes')
    expect(fetchMock.mock.calls[0][0]).toBe('https://ac.test/api/v1/installations/i1/profiles')
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'f1' }, revision: 2 }))
    await asignarTitulares('i1', 'f1', ['h1'], 'k9')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://ac.test/api/v1/installations/i1/profiles/f1/holders')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ holder_ids: ['h1'] }))
    expect(init.headers['Idempotency-Key']).toBe('k9')
  })
})
