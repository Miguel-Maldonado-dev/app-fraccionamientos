import { correoSintetico, normalizarTelefono } from './telefono'

describe('normalizarTelefono', () => {
  test.each(['3312345678', '33 1234 5678', '(33) 1234-5678', '+52 33 1234 5678', '523312345678', '5213312345678'])(
    '%s ⇒ 3312345678',
    (v) => expect(normalizarTelefono(v)).toBe('3312345678'),
  )
  test('9 dígitos ⇒ null', () => expect(normalizarTelefono('331234567')).toBeNull())
  test('vacío ⇒ null', () => expect(normalizarTelefono('')).toBeNull())
})

test('correoSintetico', () => expect(correoSintetico('3312345678')).toBe('3312345678@auth.internal'))
