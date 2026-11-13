// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeQuery, fakeSupabase } from '@/test/fake-query'

const autenticar = vi.fn()
const admin = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/app-auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/app-auth')>()),
  autenticarResidente: (r: Request) => autenticar(r),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin() }))
vi.mock('@/lib/supabase/env', () => ({ SUPABASE_URL: 'http://sb', SUPABASE_KEY: 'anon' }))

import { GET } from './route'

describe('GET /api/app/yo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 sin autenticación', async () => {
    autenticar.mockResolvedValue({ ok: false, status: 401 })
    expect((await GET(new Request('http://x'))).status).toBe(401)
  })

  it('devuelve teléfono y domicilios', async () => {
    autenticar.mockResolvedValue({
      ok: true,
      userId: 'u1',
      supabase: fakeSupabase({
        cuentas_residente: fakeQuery({ data: { telefono: '3300000001' } }),
        residentes: fakeQuery({ data: [{ domicilio_id: 5, es_principal: true, nombre: 'Ana Pérez' }] }),
      }),
    })
    admin.mockReturnValue(
      fakeSupabase({
        domicilios: fakeQuery({ data: [{ id: 5, direccion: 'Lago 1', fraccionamientos: { nombre: 'Lago Amadeo' } }] }),
      }),
    )
    const res = await GET(new Request('http://x'))
    expect(await res.json()).toEqual({
      telefono: '3300000001',
      domicilios: [{ id: 5, direccion: 'Lago 1', fraccionamiento: 'Lago Amadeo', es_principal: true, nombre: 'Ana Pérez' }],
    })
  })
})
