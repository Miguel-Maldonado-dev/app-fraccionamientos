import { describe, expect, test } from 'vitest'
import { descripcionTarjetaSchema, numeroSchema, tarjetaSchema } from './schemas'

describe('numeroSchema', () => {
  test('acepta dígitos', () => {
    expect(numeroSchema.safeParse({ valor: '5512345678' }).success).toBe(true)
  })

  test.each(['55-1234', '', '12345678901'])('rechaza %j', (valor) => {
    const r = numeroSchema.safeParse({ valor })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Solo dígitos, máximo 10')
  })
})

describe('tarjetaSchema', () => {
  test('acepta el máximo de 32 bits y recorta la descripción', () => {
    const r = tarjetaSchema.safeParse({ numero: '4294967295', descripcion: ' Auto ' })
    expect(r.success && r.data).toEqual({ numero: '4294967295', descripcion: 'Auto' })
  })

  test.each([
    ['4294967296', 'El número excede 32 bits (máximo 4294967295)'],
    ['12a', 'Solo dígitos, máximo 10'],
    ['', 'Solo dígitos, máximo 10'],
  ])('rechaza %j', (numero, mensaje) => {
    const r = tarjetaSchema.safeParse({ numero })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe(mensaje)
  })

  test('descripción de máximo 60 caracteres', () => {
    expect(descripcionTarjetaSchema.safeParse('x'.repeat(60)).success).toBe(true)
    const r = descripcionTarjetaSchema.safeParse('x'.repeat(61))
    expect(!r.success && r.error.issues[0].message).toBe('Máximo 60 caracteres')
  })
})
