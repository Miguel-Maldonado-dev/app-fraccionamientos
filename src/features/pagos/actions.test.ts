import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCuotaInfo } from '@/features/cuotas/queries'
import { getCurrentUser, getTenantContext } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { getDomicilioInfo } from '@/features/domicilios/queries'
import { registrarPagoCuota, registrarPagoExtra } from './actions'
import { MSG_CUOTA_YA_PAGADA, MSG_PAGO_SIN_MARCAR } from './messages'
import { getConceptoPago, getPagoIdPorCuota } from './queries'
import { parseRecibo } from './recibo/datos'
import { instalacionDe, recalcularPermisos } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn(), getTenantContext: vi.fn() }))
vi.mock('@/features/cuotas/queries', () => ({ getCuotaInfo: vi.fn() }))
vi.mock('@/features/domicilios/queries', () => ({ getDomicilioInfo: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ instalacionDe: vi.fn(), recalcularPermisos: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))
vi.mock('@/features/pagos/queries', () => ({
  getPagoIdPorCuota: vi.fn().mockResolvedValue(null),
  getConceptoPago: vi.fn(),
}))

const userWith = (roleName: string) =>
  ({ id: 'u1', email: 'a@b.c', userName: 'Ana', roleName, isActive: true }) as never

const cuotaPendiente = {
  id: 7,
  domicilio_id: 5,
  direccion: 'CALLE LAGO 12',
  residente_principal: 'Ana López',
  periodo: 'OCTUBRE 2026',
  anio: 2026,
  mes: 10,
  concepto_id: 2,
  concepto: 'Cuota Mensual',
  monto_recargo: 50,
  monto_descuento: 0,
  importe_cuota: 300,
  importe_base: 600,
  fecha_vencimiento: '2026-10-31',
  fecha_vencimiento_formated: '31/10/2026',
  estatus: 'Pendiente',
  estatus_calculado: 'Pendiente',
  created_at: '2026-10-01T00:00:00Z',
}

const input = { cuotaId: 7, fechaPago: '2026-10-05', metodoPagoId: 1 }

type SetupOpts = {
  role?: string
  cuota?: unknown
  pagoExistente?: number
  cuotasError?: boolean
}

function mockTenant() {
  vi.mocked(getTenantContext).mockResolvedValue({
    userId: 'u1',
    email: 'a@b.c',
    perfil: null,
    fraccionamiento: { id: 1, nombre: 'Lago Amadeo' },
  })
}

function setup(opts: SetupOpts = {}) {
  vi.mocked(getCurrentUser).mockResolvedValue(userWith(opts.role ?? 'tesorero'))
  mockTenant()
  vi.mocked(getCuotaInfo).mockResolvedValue((opts.cuota ?? cuotaPendiente) as never)
  vi.mocked(getPagoIdPorCuota).mockResolvedValue(opts.pagoExistente ?? null)
  const pagos = fakeQuery({ data: { id: 11 } })
  const cuotas = fakeQuery(opts.cuotasError ? { error: { message: 'cuotas caída' } } : {})
  const supabase = fakeSupabase({ pagos, cuotas })
  vi.mocked(createClient).mockResolvedValue(supabase as never)
  return { pagos, cuotas, supabase }
}

const REVALIDADAS = ['/domicilios/5', '/cuotas', '/pagos', '/movimientos', '/']

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(instalacionDe).mockResolvedValue(null)
  vi.mocked(recalcularPermisos).mockResolvedValue(0)
  // "Hoy" fijo (mediodía en America/Mexico_City) para que '2026-10-05' nunca sea fecha futura.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T18:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

test('con instalación, al marcar la cuota recalcula los permisos y dispara la sincronización', async () => {
  vi.mocked(instalacionDe).mockResolvedValue({ fid: 1, instalacionId: 'inst-1' })
  vi.mocked(recalcularPermisos).mockResolvedValue(1)
  const { cuotas, supabase } = setup()

  const r = await registrarPagoCuota(input)

  expect(r).toEqual({ ok: true, data: { pagoId: 11 } })
  expect(instalacionDe).toHaveBeenCalledWith(supabase, null)
  expect(recalcularPermisos).toHaveBeenCalledWith(supabase, 1)
  expect(dispararSincronizacion).toHaveBeenCalledWith(1)
  expect(cuotas.calls.length).toBeGreaterThan(0)
  expect(supabase.from.mock.invocationCallOrder.at(-1)!).toBeLessThan(
    vi.mocked(recalcularPermisos).mock.invocationCallOrder[0],
  )
})

test('sin instalación no recalcula permisos', async () => {
  setup()
  await registrarPagoCuota(input)
  expect(recalcularPermisos).not.toHaveBeenCalled()
  expect(dispararSincronizacion).not.toHaveBeenCalled()
})

test('si falla recalcular los permisos el pago no falla (lo registra en el log)', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(instalacionDe).mockResolvedValue({ fid: 1, instalacionId: 'inst-1' })
  vi.mocked(recalcularPermisos).mockRejectedValue(new Error('rpc caída'))
  setup()

  const r = await registrarPagoCuota(input)

  expect(r).toEqual({ ok: true, data: { pagoId: 11 } })
  expect(consoleError).toHaveBeenCalled()
  expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(REVALIDADAS)
  consoleError.mockRestore()
})

test('rechaza cuota pagada', async () => {
  const { pagos, cuotas } = setup({ cuota: { ...cuotaPendiente, estatus: 'Pagado' } })

  const r = await registrarPagoCuota(input)

  expect(r).toEqual({ ok: false, error: 'Esta cuota ya fue pagada.' })
  expect(MSG_CUOTA_YA_PAGADA).toBe('Esta cuota ya fue pagada.')
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
  expect(callsOf(cuotas, 'update')).toHaveLength(0)
})

test('rechaza fecha futura', async () => {
  const { pagos } = setup()

  const r = await registrarPagoCuota({ ...input, fechaPago: '2999-01-01' })

  expect(r).toEqual({ ok: false, error: 'La fecha no puede ser futura' })
  expect(getCuotaInfo).not.toHaveBeenCalled()
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
})

test('flujo completo: el insert lleva el recibo y marca pagada', async () => {
  const { pagos, cuotas, supabase } = setup()

  const r = await registrarPagoCuota(input)

  expect(r).toEqual({ ok: true, data: { pagoId: 11 } })
  expect(getCuotaInfo).toHaveBeenCalledWith(supabase, 7)

  // (3) insert del pago con importe_cuota, el usuario de la sesión y la foto del recibo.
  // Recargo 50 se incluye; descuento 0 se omite; total = importe insertado.
  const inserted = callsOf(pagos, 'insert')[0].args[0] as Record<string, unknown>
  expect(inserted).toEqual({
    domicilio_id: 5,
    cuota_id: 7,
    concepto_id: 2,
    fecha_pago: '2026-10-05',
    metodo_pago_id: 1,
    user_id: 'u1',
    importe: 300,
    recibo: {
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
    },
  })
  const recibo = inserted.recibo as Record<string, unknown>
  expect('descuento' in recibo).toBe(false)
  expect(recibo.total).toBe(inserted.importe)
  expect(parseRecibo(recibo)).not.toBeNull()
  expect(callsOf(pagos, 'select')[0].args).toEqual(['id'])

  // Sin un segundo update del pago: el recibo va en el mismo insert.
  expect(callsOf(pagos, 'update')).toHaveLength(0)

  // (6) la cuota queda Pagado
  expect(callsOf(cuotas, 'update').map((c) => c.args)).toEqual([[{ estatus_id: 2 }]])
  expect(callsOf(cuotas, 'eq').map((c) => c.args)).toEqual([['id', 7]])

  // Orden: getCuotaInfo → pago existente → insert pagos → update cuotas
  // (sin movimientos_financieros: los crea el trigger)
  expect(pagos.calls.map((c) => c.method)).toEqual(['insert', 'select', 'single'])
  expect(supabase.from.mock.calls.map(([table]) => table)).toEqual(['pagos', 'cuotas'])
  const [insertAt, cuotaAt] = supabase.from.mock.invocationCallOrder
  const cuotaInfoAt = vi.mocked(getCuotaInfo).mock.invocationCallOrder[0]
  const existenteAt = vi.mocked(getPagoIdPorCuota).mock.invocationCallOrder[0]
  expect(getPagoIdPorCuota).toHaveBeenCalledWith(supabase, 7)
  expect(cuotaInfoAt).toBeLessThan(existenteAt)
  expect(existenteAt).toBeLessThan(insertAt)
  expect(insertAt).toBeLessThan(cuotaAt)

  // (7) revalidaciones
  expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(REVALIDADAS)
})

test('recibo de cuota: descuento > 0 se incluye y sin recargo se omite; sin residente usa Sin información', async () => {
  const { pagos } = setup({
    cuota: { ...cuotaPendiente, monto_recargo: 0, monto_descuento: 30, importe_cuota: 220, residente_principal: null },
  })

  await registrarPagoCuota(input)

  const inserted = callsOf(pagos, 'insert')[0].args[0] as Record<string, unknown>
  const recibo = inserted.recibo as Record<string, unknown>
  expect(recibo.descuento).toBe(30)
  expect('recargo' in recibo).toBe(false)
  expect(recibo.residente).toBe('Sin información')
  expect(recibo.subtotal).toBe(250)
  expect(recibo.total).toBe(220)
  expect(inserted.importe).toBe(220)
})

test('rol Vigilancia no puede pagar', async () => {
  const { pagos, cuotas } = setup({ role: 'vigilancia' })

  const r = await registrarPagoCuota(input)

  expect(r).toEqual({ ok: false, error: MSG_NO_PERMISO })
  expect(getCuotaInfo).not.toHaveBeenCalled()
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
  expect(callsOf(cuotas, 'update')).toHaveLength(0)
})

test('pago ya existente: no duplica y marca pagada', async () => {
  const { pagos, cuotas } = setup({ pagoExistente: 7 })

  const r = await registrarPagoCuota(input)

  expect(r).toEqual({ ok: true, data: { pagoId: 7, yaExistia: true } })
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
  expect(callsOf(cuotas, 'update').map((c) => c.args)).toEqual([[{ estatus_id: 2 }]])
  expect(callsOf(cuotas, 'eq').map((c) => c.args)).toEqual([['id', 7]])
  expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(REVALIDADAS)
})

test('si falla marcar la cuota no lanza: avisa y revalida', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { pagos, cuotas } = setup({ cuotasError: true })

  const r = await registrarPagoCuota(input)

  expect(r).toEqual({ ok: false, error: MSG_PAGO_SIN_MARCAR })
  expect(callsOf(pagos, 'insert')).toHaveLength(1)
  expect(callsOf(cuotas, 'update')).toHaveLength(1)
  expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(REVALIDADAS)
  expect(consoleError).toHaveBeenCalled()
  consoleError.mockRestore()
})

test('subtotal sale del importe de la cuota, no del precio actual del concepto', async () => {
  const { pagos } = setup({
    cuota: { ...cuotaPendiente, monto_recargo: 50, monto_descuento: 20, importe_cuota: 530, importe_base: 600 },
  })

  await registrarPagoCuota(input)

  const inserted = callsOf(pagos, 'insert')[0].args[0] as Record<string, unknown>
  const recibo = inserted.recibo as { subtotal: number; recargo: number; descuento: number; total: number }
  expect(recibo.subtotal).toBe(500)
  expect(recibo.total).toBe(530)
  expect(recibo.subtotal + recibo.recargo - recibo.descuento).toBe(recibo.total)
})

const conceptoExtra = { id: 4, nombre: 'Tarjeta de acceso', importe: 200, tipo_pago_id: 2, created_at: '' }
const inputExtra = { domicilioId: 5, conceptoId: 4, fechaPago: '2026-10-05', metodoPagoId: 1 }

function setupExtra(opts: { role?: string; concepto?: unknown; domicilio?: unknown } = {}) {
  vi.mocked(getCurrentUser).mockResolvedValue(userWith(opts.role ?? 'tesorero'))
  mockTenant()
  vi.mocked(getConceptoPago).mockResolvedValue((opts.concepto === undefined ? conceptoExtra : opts.concepto) as never)
  vi.mocked(getDomicilioInfo).mockResolvedValue(
    (opts.domicilio === undefined
      ? { id: 5, direccion: 'CALLE LAGO 12', residente_principal: 'Ana López' }
      : opts.domicilio) as never,
  )
  const pagos = fakeQuery({ data: { id: 11 } })
  const supabase = fakeSupabase({ pagos })
  vi.mocked(createClient).mockResolvedValue(supabase as never)
  return { pagos, supabase }
}

test('pago extra: concepto de otro tipo es inválido', async () => {
  const { pagos } = setupExtra({ concepto: { ...conceptoExtra, tipo_pago_id: 1 } })

  const r = await registrarPagoExtra(inputExtra)

  expect(r).toEqual({ ok: false, error: 'Concepto inválido.' })
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
})

test('pago extra: concepto inexistente es inválido', async () => {
  const { pagos } = setupExtra({ concepto: null })

  expect(await registrarPagoExtra(inputExtra)).toEqual({ ok: false, error: 'Concepto inválido.' })
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
})

test('pago extra: domicilio inexistente', async () => {
  const { pagos } = setupExtra({ domicilio: null })

  expect(await registrarPagoExtra(inputExtra)).toEqual({ ok: false, error: 'El domicilio no existe.' })
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
})

test('pago extra: flujo completo con importe del concepto y sin cuota', async () => {
  const { pagos, supabase } = setupExtra()

  const r = await registrarPagoExtra(inputExtra)

  expect(r).toEqual({ ok: true, data: { pagoId: 11 } })
  expect(getConceptoPago).toHaveBeenCalledWith(supabase, 4)
  expect(getDomicilioInfo).toHaveBeenCalledWith(supabase, 5)
  const inserted = callsOf(pagos, 'insert')[0].args[0] as Record<string, unknown>
  expect(inserted).toEqual({
    domicilio_id: 5,
    concepto_id: 4,
    fecha_pago: '2026-10-05',
    metodo_pago_id: 1,
    user_id: 'u1',
    importe: 200,
    recibo: {
      v: 1,
      fraccionamiento: 'Lago Amadeo',
      direccion: 'CALLE LAGO 12',
      residente: 'Ana López',
      concepto: 'Tarjeta de acceso',
      fechaPago: '05/10/2026',
      subtotal: 200,
      total: 200,
    },
  })
  expect('cuota_id' in inserted).toBe(false)
  const recibo = inserted.recibo as Record<string, unknown>
  for (const clave of ['periodo', 'fechaVencimiento', 'recargo', 'descuento']) {
    expect(clave in recibo).toBe(false)
  }
  expect(parseRecibo(recibo)).not.toBeNull()
  expect(callsOf(pagos, 'select')[0].args).toEqual(['id'])
  expect(callsOf(pagos, 'update')).toHaveLength(0)
  expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual([
    '/pagos',
    '/domicilios/5',
    '/movimientos',
    '/',
  ])
})

test('pago extra: sin residente principal usa Sin información', async () => {
  const { pagos } = setupExtra({ domicilio: { id: 5, direccion: 'CALLE LAGO 12', residente_principal: null } })

  await registrarPagoExtra(inputExtra)

  const recibo = (callsOf(pagos, 'insert')[0].args[0] as { recibo: Record<string, unknown> }).recibo
  expect(recibo.residente).toBe('Sin información')
})

test('pago extra: rol Comite no puede registrar', async () => {
  const { pagos } = setupExtra({ role: 'comite' })

  expect(await registrarPagoExtra(inputExtra)).toEqual({ ok: false, error: MSG_NO_PERMISO })
  expect(getConceptoPago).not.toHaveBeenCalled()
  expect(callsOf(pagos, 'insert')).toHaveLength(0)
})
