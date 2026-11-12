import { describe, expect, test } from 'vitest'
import { fraccionamientoSchema } from './schemas'

const error = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0].message
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const base = { nombre: 'Lomas del Río', slug: 'lomas-del-rio', instalacionId: '', instalacionNombre: null, activo: true }

describe('fraccionamientoSchema', () => {
  test('recorta los textos y convierte la instalación vacía en null', () => {
    expect(
      fraccionamientoSchema.parse({ nombre: '  Lomas del Río ', slug: ' lomas-del-rio ', instalacionId: '   ', instalacionNombre: null, activo: true }),
    ).toEqual({ nombre: 'Lomas del Río', slug: 'lomas-del-rio', instalacionId: null, instalacionNombre: null, activo: true })
    expect(fraccionamientoSchema.parse(base).instalacionId).toBeNull()
  })

  test('acepta un UUID de instalación', () => {
    expect(fraccionamientoSchema.parse({ ...base, instalacionId: ` ${UUID} ` }).instalacionId).toBe(UUID)
  })

  test('instalacionNombre es texto o null y es obligatorio', () => {
    expect(fraccionamientoSchema.parse({ ...base, instalacionNombre: 'Norte' }).instalacionNombre).toBe('Norte')
    expect(fraccionamientoSchema.safeParse({ ...base, instalacionNombre: undefined }).success).toBe(false)
    expect(fraccionamientoSchema.safeParse({ ...base, instalacionNombre: 5 }).success).toBe(false)
  })

  test('rechaza un ID de instalación que no es UUID', () => {
    expect(error(fraccionamientoSchema.safeParse({ ...base, instalacionId: 'abc' }))).toBe('ID de instalación inválido')
  })

  test('exige nombre de 1 a 80 caracteres', () => {
    expect(error(fraccionamientoSchema.safeParse({ ...base, nombre: '   ' }))).toBe('El nombre es obligatorio')
    expect(fraccionamientoSchema.safeParse({ ...base, nombre: 'a'.repeat(81) }).success).toBe(false)
    expect(fraccionamientoSchema.safeParse({ ...base, nombre: 'a'.repeat(80) }).success).toBe(true)
  })

  test('el slug solo admite minúsculas, números y guiones', () => {
    expect(error(fraccionamientoSchema.safeParse({ ...base, slug: 'Lomas' }))).toBe('Usa minúsculas, números y guiones')
    for (const slug of ['', 'lomas--rio', '-lomas', 'lomas-', 'lomas rio', 'a'.repeat(61)]) {
      expect(fraccionamientoSchema.safeParse({ ...base, slug }).success).toBe(false)
    }
    expect(fraccionamientoSchema.safeParse({ ...base, slug: 'a'.repeat(60) }).success).toBe(true)
    expect(fraccionamientoSchema.safeParse({ ...base, slug: 'fracc-2' }).success).toBe(true)
  })

  test('activo es booleano', () => {
    expect(fraccionamientoSchema.safeParse({ ...base, activo: 'si' }).success).toBe(false)
  })
})
