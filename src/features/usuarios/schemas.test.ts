import { describe, expect, test } from 'vitest'
import { editarUsuarioSchema, nuevoUsuarioSchema } from './schemas'

const base = { userName: 'ana lopez', email: 'ana@lago.mx', password: '123456', rol: 'tesorero' as const }

describe('nuevoUsuarioSchema', () => {
  test('acepta datos válidos y pone el nombre en title case', () => {
    const r = nuevoUsuarioSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.userName).toBe('Ana Lopez')
  })

  test('normaliza el email a minúsculas y sin espacios', () => {
    const r = nuevoUsuarioSchema.safeParse({ ...base, email: '  Ana@Mail.COM ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('ana@mail.com')
  })

  test('rechaza contraseña de 5 caracteres', () => {
    const r = nuevoUsuarioSchema.safeParse({ ...base, password: '12345' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Mínimo 6 caracteres')
  })

  test('rechaza email inválido', () => {
    const r = nuevoUsuarioSchema.safeParse({ ...base, email: 'no-es-email' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Email inválido')
  })
})

describe('editarUsuarioSchema', () => {
  test('normaliza nombre y acepta rol comite', () => {
    const r = editarUsuarioSchema.safeParse({ userName: 'ana lopez', rol: 'comite' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({ userName: 'Ana Lopez', rol: 'comite' })
  })

  test('rechaza super_admin con "Selecciona un rol"', () => {
    const r = editarUsuarioSchema.safeParse({ userName: 'Ana', rol: 'super_admin' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Selecciona un rol')
  })

  test('el esquema nuevo también rechaza super_admin', () => {
    expect(nuevoUsuarioSchema.safeParse({ ...base, rol: 'super_admin' }).success).toBe(false)
  })

  test('rechaza nombre vacío', () => {
    expect(editarUsuarioSchema.safeParse({ userName: '  ', rol: 'tesorero' }).success).toBe(false)
  })
})
