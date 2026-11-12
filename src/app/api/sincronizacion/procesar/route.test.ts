// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const procesarSincronizaciones = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/features/sincronizacion/worker', () => ({
  procesarSincronizaciones: (...a: unknown[]) => procesarSincronizaciones(...a),
}))

import { GET, POST } from './route'

const llamar = (auth?: string) =>
  POST(
    new NextRequest('http://localhost/api/sincronizacion/procesar', {
      method: 'POST',
      headers: auth ? { Authorization: auth } : {},
    }),
  )

describe('POST /api/sincronizacion/procesar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'secreto')
    procesarSincronizaciones.mockResolvedValue({ procesadas: 3, fallidas: 1, detenidoPor429: false, omitidos: 0 })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('401 sin header', async () => {
    expect((await llamar()).status).toBe(401)
    expect(procesarSincronizaciones).not.toHaveBeenCalled()
  })

  it('401 con un secreto distinto', async () => {
    expect((await llamar('Bearer otro')).status).toBe(401)
    expect(procesarSincronizaciones).not.toHaveBeenCalled()
  })

  it('401 sin CRON_SECRET en el entorno', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await llamar('Bearer ')).status).toBe(401)
    expect((await llamar('Bearer undefined')).status).toBe(401)
    expect(procesarSincronizaciones).not.toHaveBeenCalled()
  })

  it('200 procesa todos los fraccionamientos y responde el resumen', async () => {
    const res = await llamar('Bearer secreto')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ procesadas: 3, fallidas: 1, detenidoPor429: false, omitidos: 0 })
    expect(procesarSincronizaciones).toHaveBeenCalledWith({})
  })

  it('GET es el mismo handler (Vercel Cron llama con GET)', async () => {
    expect(GET).toBe(POST)
  })
})
