import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeQuery, fakeSupabase } from '@/test/fake-query'

const getCurrentUser = vi.fn()
const createClient = vi.fn()
const cargarLogo = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: () => getCurrentUser() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }))
vi.mock('@/features/pagos/recibo/logo', () => ({ cargarLogo: () => cargarLogo() }))

import { GET } from './route'

const call = (id: string) =>
  GET(new NextRequest(`http://localhost/api/recibos/${id}`), { params: Promise.resolve({ pagoId: id }) })

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

const conPago = (data: unknown) => createClient.mockResolvedValue(fakeSupabase({ pagos: fakeQuery({ data }) }))

describe('GET /api/recibos/[pagoId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue({ id: 'u', isActive: true })
    cargarLogo.mockResolvedValue(null)
  })

  it('401 sin usuario', async () => {
    getCurrentUser.mockResolvedValue(null)
    expect((await call('1')).status).toBe(401)
  })

  it('404 con id inválido', async () => {
    expect((await call('x')).status).toBe(404)
  })

  it('404 si el pago no existe', async () => {
    conPago(null)
    expect((await call('1')).status).toBe(404)
  })

  it('404 con recibo nulo', async () => {
    conPago({ referencia: 'abc-123', recibo: null })
    const res = await call('1')
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Recibo no disponible')
  })

  it('404 con un recibo de otra versión', async () => {
    conPago({ referencia: 'abc-123', recibo: { v: 2 } })
    expect((await call('1')).status).toBe(404)
  })

  it('200 genera el PDF a partir del recibo v1', async () => {
    conPago({ referencia: 'abc-123', recibo: reciboV1 })
    const res = await call('1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe('inline; filename="abc-123.pdf"')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('%PDF')
    expect(cargarLogo).toHaveBeenCalledTimes(1)
  })

  it('sanea el nombre de archivo', async () => {
    conPago({ referencia: 'a"b\\c\r\nd-é', recibo: reciboV1 })
    const res = await call('1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toBe('inline; filename="abcd-.pdf"')
  })
})
