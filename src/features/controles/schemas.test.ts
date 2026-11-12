import { describe, expect, test } from 'vitest'
import { controlSchema } from './schemas'

const error = (input: unknown) => {
  const r = controlSchema.safeParse(input)
  return r.success ? null : r.error.issues[0].message
}

describe('controlSchema', () => {
  test('acepta de 1 a 4 botones distintos con descripción opcional', () => {
    expect(error({ botones: [{ boton: 0, rfCode: '123' }] })).toBeNull()
    expect(
      error({
        descripcion: 'Auto rojo',
        botones: [
          { boton: 0, rfCode: '1' },
          { boton: 1, rfCode: '2' },
          { boton: 2, rfCode: '3' },
          { boton: 3, rfCode: '4294967295' },
        ],
      }),
    ).toBeNull()
  })

  test('rechaza botones repetidos', () => {
    expect(
      error({
        botones: [
          { boton: 1, rfCode: '1' },
          { boton: 1, rfCode: '2' },
        ],
      }),
    ).toBe('Cada botón solo puede usarse una vez')
  })

  test('rechaza 5 botones', () => {
    expect(
      error({
        botones: [0, 1, 2, 3, 3].map((boton, i) => ({ boton, rfCode: String(i + 1) })),
      }),
    ).toBe('Máximo 4 botones')
  })

  test('rechaza un control sin botones', () => {
    expect(error({ botones: [] })).toBe('Captura el código de al menos un botón')
  })

  test('rechaza códigos RF no numéricos o de más de 32 bits', () => {
    expect(error({ botones: [{ boton: 0, rfCode: '12a' }] })).toBe('Solo dígitos, máximo 10')
    expect(error({ botones: [{ boton: 0, rfCode: '4294967296' }] })).toBe('El código excede 32 bits (máximo 4294967295)')
  })

  test('rechaza un botón fuera de 0..3', () => {
    expect(error({ botones: [{ boton: 4, rfCode: '1' }] })).toBe('Botón no válido')
  })

  test('rechaza una descripción de más de 60 caracteres', () => {
    expect(error({ descripcion: 'x'.repeat(61), botones: [{ boton: 0, rfCode: '1' }] })).toBe('Máximo 60 caracteres')
  })
})
