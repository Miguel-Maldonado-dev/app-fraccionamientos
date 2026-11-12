// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb } from '@/test/fake-db'
import { tarea } from './test-helpers'

const mocks = vi.hoisted(() => ({ client: null as unknown }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mocks.client }))
vi.mock('@/lib/access-core', async () => ({
  ...(await vi.importActual<typeof import('@/lib/access-core/errores')>('@/lib/access-core/errores')),
  ...(await import('./test-helpers')).apiFalsa(),
}))

import * as api from '@/lib/access-core'
import { AccessCoreError, AccessCoreNoConfigurado } from '@/lib/access-core'
import { procesarSincronizaciones } from './worker'
import type { Tarea } from './tipos'

const ahora = new Date('2026-11-11T12:00:00.000Z')
const crearTarjeta = vi.mocked(api.crearTarjeta)

const rpcLease = () =>
  vi.fn(async (...a: unknown[]) => ({ data: a[0] === 'adquirir_sincronizacion' ? true : null, error: null }))

function montar(tareas: Tarea[], over: Record<string, Record<string, unknown>[]> = {}, rpc = rpcLease()) {
  const db = fakeDb({
    fraccionamientos: [{ id: 7, instalacion_id: 'inst-1' }],
    domicilios: [{ id: 1, fraccionamiento_id: 7, titular_id: 'h1', perfil_asignado_id: null }],
    tarjetas_acceso: [
      { id: 10, domicilio_id: 1, numero: '111', descripcion: null, tarjeta_id: null },
      { id: 11, domicilio_id: 1, numero: '222', descripcion: null, tarjeta_id: null },
    ],
    domicilio_concepto: [{ domicilio_id: 1, concepto_id: 5 }],
    concepto_pago_acceso: [{ concepto_pago_id: 5, medios: ['tarjeta', 'control', 'pin'] }],
    sincronizaciones_acceso: tareas,
    ...over,
  }, rpc)
  mocks.client = db.client
  return db
}

const fila = (db: ReturnType<typeof montar>, id: string) =>
  db.tablas.sincronizaciones_acceso.find((t) => t.id === id) as Tarea
const crearDomOk = () => tarea({ entidad: 'domicilio', operacion: 'crear', estado: 'ok' })
const crearTj = (entidadId: number, over: Partial<Tarea> = {}) =>
  tarea({ entidad: 'tarjeta', operacion: 'crear', entidad_id: entidadId, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  crearTarjeta.mockImplementation(async () => ({ id: 'tj-nueva' }))
})

describe('procesarSincronizaciones', () => {
  it('toma el lease antes de leer las tareas y lo libera al terminar', async () => {
    const db = montar([crearDomOk(), crearTj(10)])
    await procesarSincronizaciones({ ahora })
    const llamadas = db.client.rpc.mock.calls
    expect(llamadas.map(([n]) => n)).toEqual(['adquirir_sincronizacion', 'liberar_sincronizacion'])
    const adquirir = llamadas[0][1] as { p_fraccionamiento_id: number; p_token: string }
    expect(adquirir.p_fraccionamiento_id).toBe(7)
    expect(adquirir.p_token).toMatch(/^[0-9a-f-]{36}$/)
    expect(llamadas[1][1]).toEqual(adquirir)
    const iLectura = db.client.from.mock.calls.findIndex(([t]) => t === 'sincronizaciones_acceso')
    expect(db.client.rpc.mock.invocationCallOrder[0]).toBeLessThan(db.client.from.mock.invocationCallOrder[iLectura])
  })

  it('sin el lease omite el fraccionamiento sin procesar ni liberar', async () => {
    const rpc = vi.fn(async () => ({ data: false, error: null }))
    const tj = crearTj(10)
    const db = montar([crearDomOk(), tj], {}, rpc)
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 1 })
    expect(crearTarjeta).not.toHaveBeenCalled()
    expect(fila(db, tj.id)).toEqual(tj)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('libera el lease aunque la corrida lance', async () => {
    const db = montar([crearTj(10)])
    const original = db.client.from.getMockImplementation()!
    db.client.from.mockImplementation((t: string) => {
      if (t === 'sincronizaciones_acceso') throw new Error('boom')
      return original(t)
    })
    await expect(procesarSincronizaciones({ ahora })).rejects.toThrow('boom')
    expect(db.client.rpc).toHaveBeenLastCalledWith('liberar_sincronizacion', expect.objectContaining({ p_fraccionamiento_id: 7 }))
  })

  it('libera el lease cuando un 429 detiene la corrida', async () => {
    crearTarjeta.mockRejectedValueOnce(new AccessCoreError(429, 'rate_limited', 'Demasiadas', 30))
    const db = montar([crearDomOk(), crearTj(10)])
    await procesarSincronizaciones({ ahora })
    expect(db.client.rpc).toHaveBeenLastCalledWith('liberar_sincronizacion', expect.objectContaining({ p_fraccionamiento_id: 7 }))
  })

  it('renueva el lease con el mismo token cada 10 tareas', async () => {
    const tarjetas = Array.from({ length: 21 }, (_, i) => ({ id: 100 + i, domicilio_id: 1, numero: String(i + 1), descripcion: null, tarjeta_id: null }))
    const db = montar([crearDomOk(), ...tarjetas.map((t) => crearTj(t.id))], { tarjetas_acceso: tarjetas })
    expect((await procesarSincronizaciones({ ahora })).procesadas).toBe(21)
    const adquirir = db.client.rpc.mock.calls.filter(([n]) => n === 'adquirir_sincronizacion')
    expect(adquirir).toHaveLength(3)
    expect(new Set(adquirir.map(([, a]) => (a as { p_token: string }).p_token)).size).toBe(1)
  })

  it('si pierde el lease al renovar deja de procesar y lo libera', async () => {
    let n = 0
    const rpc = vi.fn(async (...a: unknown[]) => ({
      data: a[0] === 'adquirir_sincronizacion' ? ++n === 1 : null,
      error: null,
    }))
    const tarjetas = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, domicilio_id: 1, numero: String(i + 1), descripcion: null, tarjeta_id: null }))
    montar([crearDomOk(), ...tarjetas.map((t) => crearTj(t.id))], { tarjetas_acceso: tarjetas }, rpc)
    expect((await procesarSincronizaciones({ ahora })).procesadas).toBe(10)
    expect(rpc).toHaveBeenLastCalledWith('liberar_sincronizacion', expect.anything())
  })

  it('omite los fraccionamientos sin instalación', async () => {
    const db = montar([crearDomOk(), crearTj(10)], { fraccionamientos: [{ id: 7, instalacion_id: null }] })
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 0 })
    expect(db.client.rpc).not.toHaveBeenCalled()
  })

  it('filtra por fraccionamiento', async () => {
    const db = montar([], {
      fraccionamientos: [
        { id: 7, instalacion_id: 'inst-1' },
        { id: 8, instalacion_id: 'inst-2' },
      ],
    })
    await procesarSincronizaciones({ fraccionamientoId: 8, ahora })
    expect(db.client.rpc).toHaveBeenCalledTimes(2)
    expect(db.client.rpc).toHaveBeenCalledWith('adquirir_sincronizacion', expect.objectContaining({ p_fraccionamiento_id: 8 }))
  })

  it('una tarjeta espera al domicilio crear pendiente sin sumar intento', async () => {
    const crear = tarea({ entidad: 'domicilio', operacion: 'crear', proximo_intento_at: '2026-11-11T13:00:00.000Z' })
    const tj = crearTj(10)
    const db = montar([crear, tj], { domicilios: [{ id: 1, fraccionamiento_id: 7, titular_id: null }] })
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 0 })
    expect(crearTarjeta).not.toHaveBeenCalled()
    expect(fila(db, tj.id)).toMatchObject({ estado: 'pendiente', intentos: 0 })
    expect(db.ops.filter((o) => o.tabla === 'sincronizaciones_acceso')).toHaveLength(0)
  })

  it('una tarjeta espera mientras el domicilio crear no esté en ok aunque haya titular', async () => {
    const tj = crearTj(10)
    const db = montar([tarea({ entidad: 'domicilio', operacion: 'crear', estado: 'error' }), tj])
    await procesarSincronizaciones({ ahora })
    expect(crearTarjeta).not.toHaveBeenCalled()
    expect(fila(db, tj.id)).toEqual(tj)
  })

  it('con el domicilio crear en ok procesa la tarjeta y guarda tarjeta_id', async () => {
    const tj = crearTj(10)
    const db = montar([crearDomOk(), tj])
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 1, fallidas: 0, detenidoPor429: false, omitidos: 0 })
    expect(db.tablas.tarjetas_acceso[0].tarjeta_id).toBe('tj-nueva')
    expect(fila(db, tj.id)).toMatchObject({ estado: 'ok', updated_at: ahora.toISOString() })
  })

  it('en la misma corrida crea el domicilio y luego su tarjeta', async () => {
    vi.mocked(api.crearTitular).mockResolvedValueOnce({ id: 'h-nuevo' })
    const crear = tarea({ entidad: 'domicilio', operacion: 'crear', carga: { kind: 'domicilio', name: 'A', address: 'A', notes: '' } })
    const tj = crearTj(10)
    const db = montar([crear, tj], { domicilios: [{ id: 1, fraccionamiento_id: 7, titular_id: null }] })
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 2, fallidas: 0, detenidoPor429: false, omitidos: 0 })
    expect(db.tablas.domicilios[0].titular_id).toBe('h-nuevo')
    expect(crearTarjeta).toHaveBeenCalledWith('inst-1', { card_code: 111, holder_id: 'h-nuevo', description: '' }, tj.id)
  })

  it('salta las tareas de un domicilio sin titular aunque no haya domicilio crear', async () => {
    const tj = crearTj(10)
    const db = montar([tj], { domicilios: [{ id: 1, fraccionamiento_id: 7, titular_id: null }] })
    await procesarSincronizaciones({ ahora })
    expect(crearTarjeta).not.toHaveBeenCalled()
    expect(fila(db, tj.id).intentos).toBe(0)
  })

  it('una tarjeta con 409 pasa a error y otra del mismo domicilio sí se procesa', async () => {
    crearTarjeta.mockRejectedValueOnce(new AccessCoreError(409, 'conflict', 'La tarjeta ya existe'))
    const a = crearTj(10)
    const b = crearTj(11)
    const db = montar([crearDomOk(), a, b])
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 1, fallidas: 1, detenidoPor429: false, omitidos: 0 })
    expect(fila(db, a.id)).toMatchObject({ estado: 'error', intentos: 1, ultimo_error: 'La tarjeta ya existe' })
    expect(fila(db, b.id).estado).toBe('ok')
  })

  it('con la red caída queda pendiente y aplica la escalera', async () => {
    crearTarjeta.mockRejectedValueOnce(new AccessCoreError(0, 'network_error', 'Sin red'))
    const tj = crearTj(10)
    const db = montar([crearDomOk(), tj])
    await procesarSincronizaciones({ ahora })
    expect(fila(db, tj.id)).toMatchObject({
      estado: 'pendiente',
      intentos: 1,
      ultimo_error: 'Sin red',
      proximo_intento_at: '2026-11-11T12:01:00.000Z',
    })
  })

  it('tras 20 intentos pasa a error', async () => {
    crearTarjeta.mockRejectedValueOnce(new AccessCoreError(0, 'network_error', 'Sin red'))
    const tj = crearTj(10, { intentos: 19 })
    const db = montar([crearDomOk(), tj])
    await procesarSincronizaciones({ ahora })
    expect(fila(db, tj.id)).toMatchObject({ estado: 'error', intentos: 20 })
  })

  it('con 429 detiene la corrida y respeta Retry-After', async () => {
    crearTarjeta.mockRejectedValueOnce(new AccessCoreError(429, 'rate_limited', 'Demasiadas', 30))
    const a = crearTj(10)
    const b = crearTj(11)
    const db = montar([crearDomOk(), a, b])
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 0, fallidas: 0, detenidoPor429: true, omitidos: 0 })
    expect(crearTarjeta).toHaveBeenCalledTimes(1)
    expect(fila(db, a.id)).toMatchObject({ estado: 'pendiente', intentos: 0, proximo_intento_at: '2026-11-11T12:00:30.000Z' })
    expect(fila(db, b.id)).toEqual(b)
  })

  it('sin configuración detiene la corrida sin tocar tareas y avisa una vez', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    crearTarjeta.mockRejectedValue(new AccessCoreNoConfigurado())
    const a = crearTj(10)
    const b = crearTj(11)
    const db = montar([crearDomOk(), a, b])
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 0, noConfigurado: true })
    expect(fila(db, a.id)).toEqual(a)
    expect(fila(db, b.id)).toEqual(b)
    expect(consola).toHaveBeenCalledTimes(1)
    consola.mockRestore()
  })

  it('si la instalación cambió tras tomar el lease, omite el fraccionamiento y libera', async () => {
    const tj = crearTj(10)
    const db = montar([crearDomOk(), tj])
    const rpc = db.client.rpc.getMockImplementation()!
    db.client.rpc.mockImplementation(async (n: string, a: unknown) => {
      if (n === 'adquirir_sincronizacion') db.tablas.fraccionamientos[0].instalacion_id = 'inst-2'
      return rpc(n, a)
    })
    expect(await procesarSincronizaciones({ ahora })).toEqual({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 1 })
    expect(crearTarjeta).not.toHaveBeenCalled()
    expect(fila(db, tj.id)).toEqual(tj)
    expect(db.client.rpc.mock.calls.map(([n]) => n)).toEqual(['adquirir_sincronizacion', 'liberar_sincronizacion'])
  })

  it('si la instalación quedó en null tras tomar el lease, omite el fraccionamiento', async () => {
    const tj = crearTj(10)
    const db = montar([crearDomOk(), tj])
    const rpc = db.client.rpc.getMockImplementation()!
    db.client.rpc.mockImplementation(async (n: string, a: unknown) => {
      if (n === 'adquirir_sincronizacion') db.tablas.fraccionamientos[0].instalacion_id = null
      return rpc(n, a)
    })
    await procesarSincronizaciones({ ahora })
    expect(crearTarjeta).not.toHaveBeenCalled()
  })

  it('las tareas bloqueadas no agotan el límite: procesa una más nueva de otro domicilio', async () => {
    const bloqueada = crearTj(10, { created_at: '2026-11-11T09:00:00.000Z' })
    const otra = tarea({ entidad: 'tarjeta', operacion: 'crear', domicilio_id: 2, entidad_id: 30, created_at: '2026-11-11T09:30:00.000Z' })
    const db = montar(
      [tarea({ entidad: 'domicilio', operacion: 'crear', estado: 'error' }), bloqueada, otra],
      {
        domicilios: [
          { id: 1, fraccionamiento_id: 7, titular_id: null },
          { id: 2, fraccionamiento_id: 7, titular_id: 'h2' },
        ],
        tarjetas_acceso: [{ id: 30, domicilio_id: 2, numero: '333', descripcion: null, tarjeta_id: null }],
      },
    )
    expect((await procesarSincronizaciones({ ahora, limite: 1 })).procesadas).toBe(1)
    expect(fila(db, otra.id).estado).toBe('ok')
    expect(fila(db, bloqueada.id)).toEqual(bloqueada)
  })

  it('lee como máximo 10 × limite filas por fraccionamiento', async () => {
    const bloqueadas = Array.from({ length: 25 }, () => crearTj(10))
    const db = montar([tarea({ entidad: 'domicilio', operacion: 'crear', estado: 'error' }), ...bloqueadas])
    const limit = vi.fn()
    const original = db.client.from.getMockImplementation()!
    db.client.from.mockImplementation((t: string) => {
      const b = original(t)
      if (t !== 'sincronizaciones_acceso') return b
      const orig = b.limit
      return Object.assign(b, { limit: (n: number) => (limit(n), orig(n)) })
    })
    await procesarSincronizaciones({ ahora, limite: 2 })
    expect(limit).toHaveBeenCalledWith(20)
  })

  it('respeta el límite y el orden por created_at', async () => {
    const tardia = crearTj(11, { created_at: '2026-11-11T09:59:00.000Z' })
    const temprana = crearTj(10, { created_at: '2026-11-11T09:58:00.000Z' })
    const db = montar([crearDomOk(), tardia, temprana])
    await procesarSincronizaciones({ ahora, limite: 1 })
    expect(fila(db, temprana.id).estado).toBe('ok')
    expect(fila(db, tardia.id).estado).toBe('pendiente')
  })
})
