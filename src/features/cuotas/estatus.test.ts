import { describe, expect, test } from 'vitest'
import { conGracia, estatusVisible } from './estatus'

describe('estatusVisible', () => {
  test('usa estatus_calculado cuando existe', () => {
    expect(estatusVisible({ estatus: 'Pendiente', estatus_calculado: 'En gracia' })).toBe('En gracia')
  })

  test('cae al estatus almacenado si no hay calculado', () => {
    expect(estatusVisible({ estatus: 'Vencido' })).toBe('Vencido')
    expect(estatusVisible({ estatus: 'Pagado', estatus_calculado: null })).toBe('Pagado')
  })
})

describe('conGracia', () => {
  test('agrega En gracia y no ofrece Cancelado (las canceladas no se listan)', () => {
    expect(conGracia(['Pendiente', 'Pagado', 'Vencido', 'Cancelado'])).toEqual(['Pendiente', 'En gracia', 'Pagado', 'Vencido'])
  })
})
