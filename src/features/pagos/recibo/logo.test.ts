// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { cargarLogo } from './logo'

vi.mock('server-only', () => ({}))

describe('cargarLogo', () => {
  it('devuelve un data URL PNG', async () => {
    const logo = await cargarLogo()
    expect(logo?.startsWith('data:image/png;base64,')).toBe(true)
    expect(await cargarLogo()).toBe(logo)
  })
})
