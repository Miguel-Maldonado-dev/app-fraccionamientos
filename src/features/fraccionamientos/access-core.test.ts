import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '@/lib/access-core'
import { fakeQuery, fakeSupabase } from '@/test/fake-query'
import { listarInstalacionesDisponibles, listarSalidasDe } from './access-core'

vi.mock('@/lib/access-core', () => ({
  listarInstalaciones: vi.fn(),
  listarSalidas: vi.fn(),
  listarPaneles: vi.fn(),
}))

const A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const B = '9a1b2c3d-4e5f-41a2-8b3c-0123456789ab'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('listarInstalacionesDisponibles', () => {
  test('quita las instalaciones ya vinculadas', async () => {
    vi.mocked(api.listarInstalaciones).mockResolvedValue([
      { id: A, name: 'Norte', revision: 1 },
      { id: B, name: 'Sur', revision: 1 },
    ])
    const sb = fakeSupabase({ fraccionamientos: fakeQuery({ data: [{ instalacion_id: A }] }) }) as never
    expect(await listarInstalacionesDisponibles(sb)).toEqual([{ id: B, nombre: 'Sur' }])
  })

  test('null si la API falla', async () => {
    vi.mocked(api.listarInstalaciones).mockRejectedValue(new Error('red'))
    const sb = fakeSupabase({ fraccionamientos: fakeQuery({ data: [] }) }) as never
    expect(await listarInstalacionesDisponibles(sb)).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })

  test('null si falta la llave (no configurado)', async () => {
    vi.mocked(api.listarInstalaciones).mockRejectedValue(new Error('no configurado'))
    const sb = fakeSupabase({ fraccionamientos: fakeQuery({ data: [] }) }) as never
    expect(await listarInstalacionesDisponibles(sb)).toBeNull()
  })
})

describe('listarSalidasDe', () => {
  test('une cada salida con el código de su panel', async () => {
    vi.mocked(api.listarSalidas).mockResolvedValue([
      { id: 's1', panel_id: 'p1', output_index: 2, alias: 'Portón', duration_ms: 1, reader_mask: 0, enabled: true },
    ])
    vi.mocked(api.listarPaneles).mockResolvedValue([
      { id: 'p1', panel_code: 'PNL-1', status: 'active', online: true, last_sync_at: null, synced_revision: 1, software_version: null },
    ])
    expect(await listarSalidasDe(A)).toEqual([{ panelId: 'p1', panelCodigo: 'PNL-1', salida: 2, alias: 'Portón' }])
    expect(api.listarSalidas).toHaveBeenCalledWith(A)
  })

  test('null si la API falla', async () => {
    vi.mocked(api.listarSalidas).mockRejectedValue(new Error('boom'))
    vi.mocked(api.listarPaneles).mockResolvedValue([])
    expect(await listarSalidasDe(A)).toBeNull()
  })
})
