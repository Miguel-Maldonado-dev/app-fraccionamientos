// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { borrarControl, crearControl, reemplazarControl } from './controles'

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

describe('controles', () => {
  const cuerpo = {
    holder_id: 'h1',
    description: 'Control',
    buttons: [{ button: 0, rf_code: 99, outputs: { p1: 2, p2: null } }],
  }

  it('crearControl manda buttons[].outputs', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'c1', buttons: [] }, revision: 1 }, 201))
    const control = await crearControl('i1', cuerpo, 'k1')
    expect(control.id).toBe('c1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${B}/controls`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).buttons[0].outputs).toEqual({ p1: 2, p2: null })
    expect(init.headers['Idempotency-Key']).toBe('k1')
  })

  it('reemplaza con PUT y borra con DELETE', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'c1', buttons: [] }, revision: 2 }))
    await reemplazarControl('i1', 'c1', { ...cuerpo, description: 'x' }, 'k2')
    expect(fetchMock.mock.calls[0][0]).toBe(`${B}/controls/c1`)
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    fetchMock.mockResolvedValueOnce(ok({ data: { id: 'c1' }, revision: 3 }))
    await borrarControl('i1', 'c1', 'k3')
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
    expect(fetchMock.mock.calls[1][1].headers['Idempotency-Key']).toBe('k3')
  })
})
