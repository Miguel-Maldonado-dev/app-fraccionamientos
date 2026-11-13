// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'

const autenticar = vi.fn()
const cargarLogo = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/app-auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/app-auth')>()),
  autenticarResidente: (r: Request) => autenticar(r),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/env', () => ({ SUPABASE_URL: 'http://sb', SUPABASE_KEY: 'anon' }))
vi.mock('@/features/pagos/recibo/logo', () => ({ cargarLogo: () => cargarLogo() }))

import { GET } from './route'

const call = (id: string) => GET(new Request(`http://x/api/app/pagos/${id}/recibo`), { params: Promise.resolve({ id }) })

const reciboV1 = {
  v: 1,
  fraccionamiento: 'Lago Amadeo',
  direccion: 'CALLE LAGO 12',
  residente: 'Ana López',
  concepto: 'Cuota Mensual',
  periodo: 'OCTUBRE 2026',
  fechaVencimiento: '31/10/2026',
  fechaPago: '05/10/2026',
  subtotal: 250,
  recargo: 50,
  total: 300,
}

const conPago = (data: unknown) => {
  const pagos = fakeQuery({ data })
  autenticar.mockResolvedValue({ ok: true, userId: 'u1', supabase: fakeSupabase({ pagos }) })
  return pagos
}

describe('GET /api/app/pagos/[id]/recibo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cargarLogo.mockResolvedValue(null)
  })

  it('propaga el fallo de autenticación (403 otro_dispositivo)', async () => {
    autenticar.mockResolvedValue({ ok: false, status: 403, codigo: 'otro_dispositivo' })
    const res = await call('1')
    expect(res.status).toBe(403)
    expect((await res.json()).codigo).toBe('otro_dispositivo')
  })

  it('404 si el pago no es visible para el residente (ajeno)', async () => {
    const pagos = conPago(null)
    expect((await call('7')).status).toBe(404)
    expect(callsOf(pagos, 'eq')[0].args).toEqual(['id', 7])
  })

  it('404 sin recibo o id inválido', async () => {
    conPago({ referencia: 'abc', recibo: null })
    expect((await call('7')).status).toBe(404)
    expect((await call('x')).status).toBe(404)
  })

  it('200 PDF del recibo propio', async () => {
    conPago({ referencia: 'abc-123', recibo: reciboV1 })
    const res = await call('7')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="abc-123.pdf"')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })
})
