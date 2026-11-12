import { describe, expect, it } from 'vitest'
import { ESCALERA_MS, MAX_INTENTOS, proximoIntento } from './reintentos'

const ahora = new Date('2026-11-11T12:00:00.000Z')
const MIN = 60_000

describe('proximoIntento', () => {
  it.each([
    [0, 1 * MIN],
    [1, 5 * MIN],
    [2, 15 * MIN],
    [3, 60 * MIN],
    [4, 360 * MIN],
    [5, 360 * MIN],
  ])('con %i intentos espera %i ms', (intentos, espera) => {
    expect(proximoIntento(intentos, ahora).getTime() - ahora.getTime()).toBe(espera)
  })

  it('expone la escalera y el máximo', () => {
    expect(ESCALERA_MS).toEqual([60_000, 300_000, 900_000, 3_600_000])
    expect(MAX_INTENTOS).toBe(20)
  })
})
