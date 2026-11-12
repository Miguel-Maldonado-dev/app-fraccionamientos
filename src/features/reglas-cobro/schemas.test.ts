import { describe, expect, test } from 'vitest'
import { REGLAS_COBRO_POR_OMISION, reglasCobroSchema } from './schemas'

describe('reglasCobroSchema', () => {
  test('acepta los valores por omisión', () => {
    expect(reglasCobroSchema.safeParse(REGLAS_COBRO_POR_OMISION).success).toBe(true)
  })
  test('rechaza 29 en generación', () => {
    expect(reglasCobroSchema.safeParse({ ...REGLAS_COBRO_POR_OMISION, diaGeneracion: 29 }).success).toBe(false)
  })
  test('rechaza 61 en gracia', () => {
    expect(reglasCobroSchema.safeParse({ ...REGLAS_COBRO_POR_OMISION, diasGracia: 61 }).success).toBe(false)
  })
  test.each([
    { diaVencimiento: 32 },
    { diaVencimiento: 0 },
    { cuotasParaMoroso: 0 },
    { cuotasParaMoroso: 13 },
    { diasGracia: 1.5 },
    { diasGracia: -1 },
  ])('rechaza %j', (cambio) => {
    expect(reglasCobroSchema.safeParse({ ...REGLAS_COBRO_POR_OMISION, ...cambio }).success).toBe(false)
  })
})
