import { describe, expect, it } from 'vitest'
import { parseRecibo } from './datos'

const base = {
  v: 1,
  fraccionamiento: 'Lago Amadeo',
  direccion: 'Calle 1 #2',
  residente: 'Ana Pérez',
  concepto: 'Cuota mensual',
  periodo: 'Ene/2026',
  fechaVencimiento: '10/01/2026',
  fechaPago: '05/01/2026',
  subtotal: 500,
  recargo: 50,
  descuento: 25,
  total: 525,
}

describe('parseRecibo', () => {
  it('acepta un objeto v1 completo', () => {
    expect(parseRecibo(base)).toEqual(base)
  })
  it('rechaza v: 2', () => {
    expect(parseRecibo({ ...base, v: 2 })).toBeNull()
  })
  it('rechaza un objeto sin total', () => {
    const sinTotal: Record<string, unknown> = { ...base }
    delete sinTotal.total
    expect(parseRecibo(sinTotal)).toBeNull()
  })
  it('acepta sin periodo, recargo ni descuento', () => {
    const min: Record<string, unknown> = { ...base }
    for (const k of ['periodo', 'recargo', 'descuento', 'fechaVencimiento']) delete min[k]
    expect(parseRecibo(min)).not.toBeNull()
  })
  it('rechaza valores no objeto', () => {
    expect(parseRecibo(null)).toBeNull()
    expect(parseRecibo('x')).toBeNull()
  })
})
