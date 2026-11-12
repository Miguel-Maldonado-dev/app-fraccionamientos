import { describe, expect, test } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  test('minúsculas, sin acentos y con guiones', () => {
    expect(slugify('Lomas del Río')).toBe('lomas-del-rio')
  })

  test('colapsa símbolos y espacios y recorta guiones de los extremos', () => {
    expect(slugify('  Fracc. Ñandú  #2 ')).toBe('fracc-nandu-2')
  })

  test('texto sin letras ni números queda vacío', () => {
    expect(slugify(' -- ¿? ')).toBe('')
  })
})
