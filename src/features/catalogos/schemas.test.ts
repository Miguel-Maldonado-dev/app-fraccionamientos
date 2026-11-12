import { describe, expect, it } from 'vitest'
import { catalogoSchema, tipoCuotaSchema } from './schemas'

const error = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0].message

describe('catalogoSchema', () => {
  it('recorta el nombre y convierte el importe', () => {
    expect(catalogoSchema.parse({ nombre: '  Acceso Total  ', importe: '250.5' })).toEqual({
      nombre: 'Acceso Total',
      importe: 250.5,
    })
  })

  it('exige nombre', () => {
    expect(error(catalogoSchema.safeParse({ nombre: '', importe: '1' }))).toBe('El nombre es obligatorio')
    expect(error(catalogoSchema.safeParse({ nombre: '   ', importe: '1' }))).toBe('El nombre es obligatorio')
  })

  it('limita el nombre a 80 caracteres', () => {
    expect(error(catalogoSchema.safeParse({ nombre: 'a'.repeat(81), importe: '1' }))).toBe('Máximo 80 caracteres')
  })

  it('el importe debe ser mayor a 0', () => {
    expect(error(catalogoSchema.safeParse({ nombre: 'X', importe: '0' }))).toBe('El importe debe ser mayor a 0')
    expect(error(catalogoSchema.safeParse({ nombre: 'X', importe: '-5' }))).toBe('Ingresa un importe válido')
  })

  it('rechaza importes con coma o vacíos', () => {
    expect(error(catalogoSchema.safeParse({ nombre: 'X', importe: '250,50' }))).toBe('Ingresa un importe válido')
    expect(error(catalogoSchema.safeParse({ nombre: 'X', importe: '' }))).toBe('Ingresa un importe válido')
  })

  it('máximo 2 decimales y 999,999.99', () => {
    expect(error(catalogoSchema.safeParse({ nombre: 'X', importe: '10.123' }))).toBe('Máximo 2 decimales')
    expect(error(catalogoSchema.safeParse({ nombre: 'X', importe: '1000000' }))).toBe('El importe máximo es 999,999.99')
    expect(catalogoSchema.parse({ nombre: 'X', importe: '999999.99' }).importe).toBe(999999.99)
  })

  it('acepta importes numéricos', () => {
    expect(catalogoSchema.parse({ nombre: 'X', importe: 100 }).importe).toBe(100)
  })
})

describe('tipoCuotaSchema', () => {
  const PERFIL = 'aaaaaaaa-0000-0000-0000-000000000001'

  it('exige el arreglo de medios', () => {
    expect(tipoCuotaSchema.safeParse({ nombre: 'X', importe: '1' }).success).toBe(false)
    expect(tipoCuotaSchema.parse({ nombre: 'X', importe: '1', medios: ['tarjeta', 'telefono'] })).toEqual({
      nombre: 'X',
      importe: 1,
      medios: ['tarjeta', 'telefono'],
      perfilCorrienteId: null,
      perfilCorrienteNombre: null,
      perfilMorosoId: null,
      perfilMorosoNombre: null,
    })
  })

  it('rechaza medios desconocidos', () => {
    expect(tipoCuotaSchema.safeParse({ nombre: 'X', importe: '1', medios: ['llave'] }).success).toBe(false)
  })

  it('acepta los permisos como uuid y convierte el vacío en null', () => {
    const r = tipoCuotaSchema.parse({
      nombre: 'X',
      importe: '1',
      medios: [],
      perfilCorrienteId: PERFIL,
      perfilCorrienteNombre: 'Residentes',
      perfilMorosoId: '',
      perfilMorosoNombre: '',
    })
    expect(r).toMatchObject({
      perfilCorrienteId: PERFIL,
      perfilCorrienteNombre: 'Residentes',
      perfilMorosoId: null,
      perfilMorosoNombre: null,
    })
  })

  it('rechaza un permiso que no es uuid', () => {
    expect(tipoCuotaSchema.safeParse({ nombre: 'X', importe: '1', medios: [], perfilMorosoId: 'abc' }).success).toBe(
      false,
    )
  })
})
