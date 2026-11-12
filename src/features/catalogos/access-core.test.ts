import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '@/lib/access-core'
import { listarPerfilesDe } from './access-core'

vi.mock('@/lib/access-core', () => ({ listarPerfiles: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('listarPerfilesDe', () => {
  test('devuelve id y nombre de los perfiles de la instalación', async () => {
    vi.mocked(api.listarPerfiles).mockResolvedValue([{ id: 'p1', name: 'Residentes', holder_ids: [] }] as never)
    expect(await listarPerfilesDe('inst-1')).toEqual([{ id: 'p1', nombre: 'Residentes' }])
    expect(api.listarPerfiles).toHaveBeenCalledWith('inst-1')
  })

  test('null si la API falla', async () => {
    vi.mocked(api.listarPerfiles).mockRejectedValue(new Error('boom'))
    expect(await listarPerfilesDe('inst-1')).toBeNull()
  })
})
