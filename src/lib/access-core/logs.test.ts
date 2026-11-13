// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const llamar = vi.fn()
vi.mock('./http', () => ({ llamar: (...a: unknown[]) => llamar(...a) }))

import { listarLogs } from './logs'

beforeEach(() => llamar.mockReset())

describe('listarLogs', () => {
  it('pide la respuesta completa y conserva page/total', async () => {
    llamar.mockResolvedValue({ data: [{ id: 1 }], page: 3, page_size: 50, total: 120 })
    const r = await listarLogs('i1', { desde: '2026-11-01', hasta: '2026-11-13', pagina: 3 })
    expect(r).toEqual({ data: [{ id: 1 }], page: 3, page_size: 50, total: 120 })
  })

  it('arma la URL con filtros y los codifica', async () => {
    llamar.mockResolvedValue({ data: [], page: 2, page_size: 50, total: 0 })
    await listarLogs('i1', { desde: '2026-11-01', hasta: '2026-11-13', resultado: 'denegado', pagina: 2 })
    expect(llamar).toHaveBeenCalledWith(
      'GET',
      '/installations/i1/logs?desde=2026-11-01&hasta=2026-11-13&resultado=denegado&pagina=2',
      { completo: true },
    )
    await listarLogs('i1', { desde: 'a', hasta: 'b', panel: 'P 1', titular: 't', origen: '4', pagina: 1 })
    expect(llamar.mock.calls[1][1]).toBe('/installations/i1/logs?desde=a&hasta=b&panel=P%201&titular=t&origen=4&pagina=1')
  })

  it('omite filtros vacíos', async () => {
    llamar.mockResolvedValue({ data: [], page: 1, page_size: 50, total: 0 })
    await listarLogs('i1', { desde: 'a', hasta: 'b', panel: '', titular: undefined, pagina: 1 })
    expect(llamar.mock.calls[0][1]).toBe('/installations/i1/logs?desde=a&hasta=b&pagina=1')
  })
})
