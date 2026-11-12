import { describe, expect, test } from 'vitest'
import { pagosUsuarioFiltroSchema } from './schemas'
import { totalImporte } from './totals'

const uuid = '123e4567-e89b-42d3-a456-426614174000'

describe('pagosUsuarioFiltroSchema', () => {
  test('acepta filtros válidos', () => {
    expect(
      pagosUsuarioFiltroSchema.safeParse({ usuario: uuid, inicio: '2026-01-01', fin: '2026-01-31' }).success,
    ).toBe(true)
  })

  test('rechaza inicio mayor que fin', () => {
    const r = pagosUsuarioFiltroSchema.safeParse({ usuario: uuid, inicio: '2026-02-01', fin: '2026-01-31' })
    expect(r.success).toBe(false)
  })

  test('rechaza uuid inválido', () => {
    expect(
      pagosUsuarioFiltroSchema.safeParse({ usuario: 'abc', inicio: '2026-01-01', fin: '2026-01-31' }).success,
    ).toBe(false)
  })
})

describe('totalImporte', () => {
  test('suma tratando null como 0', () => {
    expect(totalImporte([{ importe: 100 }, { importe: null }, { importe: 50.5 }])).toBe(150.5)
  })
})
