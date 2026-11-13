// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const autenticar = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/app-auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/app-auth')>()),
  autenticarResidente: (r: Request) => autenticar(r),
}))
vi.mock('@/lib/supabase/env', () => ({ SUPABASE_URL: 'http://sb', SUPABASE_KEY: 'anon' }))

import { GET } from './route'

const call = (id: string) => GET(new Request('http://x'), { params: Promise.resolve({ id }) })
const conRpc = (r: unknown) => autenticar.mockResolvedValue({ ok: true, userId: 'u', supabase: { rpc: vi.fn().mockResolvedValue(r) } })

describe('GET /api/app/domicilios/[id]/estado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 sin autenticación', async () => {
    autenticar.mockResolvedValue({ ok: false, status: 401 })
    expect((await call('1')).status).toBe(401)
  })

  it('404 si 42501 (domicilio ajeno)', async () => {
    conRpc({ data: null, error: { code: '42501' } })
    expect((await call('1')).status).toBe(404)
  })

  it('devuelve el estado', async () => {
    conRpc({ data: { moroso: false, botones: [] }, error: null })
    const res = await call('1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ moroso: false, botones: [] })
  })
})
