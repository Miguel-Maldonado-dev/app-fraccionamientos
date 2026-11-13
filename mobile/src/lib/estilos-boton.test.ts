import { estiloBoton } from './estilos-boton'

test('azul habilitado usa el degradado', () => {
  expect(estiloBoton('azul', true).colores).toEqual(['#087BE8', '#0FB5D8'])
})
test('deshabilitado es gris sin degradado aunque sea azul', () => {
  const e = estiloBoton('azul', false)
  expect(e.colores).toEqual(['#EEF2F6'])
  expect(e.titulo).toBe('#B8C4D0')
  expect(e.icono).toBe('#B8C4D0')
})
test('sin estilo (servidor viejo) ⇒ azul_claro', () => {
  expect(estiloBoton(undefined, true)).toEqual(estiloBoton('azul_claro', true))
  expect(estiloBoton(undefined, true).colores).toEqual(['#E6F1FD'])
})
test('estilo desconocido ⇒ azul_claro', () => {
  expect(estiloBoton('rojo', true)).toEqual(estiloBoton('azul_claro', true))
  expect(estiloBoton('toString', true)).toEqual(estiloBoton('azul_claro', true))
})
test('navy y turquesa', () => {
  expect(estiloBoton('navy', true).colores).toEqual(['#071F49', '#0B3270'])
  expect(estiloBoton('turquesa', true)).toMatchObject({ colores: ['#DDF6F8'], titulo: '#071F49', icono: '#0B9DB8', chip: '#C3EDF1' })
})
test('oscuro: azul_claro y turquesa cambian; azul igual', () => {
  expect(estiloBoton('azul_claro', true, 'oscuro')).toMatchObject({ colores: ['#17304F'], titulo: '#E6EDF5', icono: '#6CB6FF' })
  expect(estiloBoton('turquesa', true, 'oscuro')).toMatchObject({ colores: ['#123D45'], titulo: '#E6EDF5', icono: '#4FD1E0' })
  expect(estiloBoton('azul', true, 'oscuro')).toEqual(estiloBoton('azul', true))
  expect(estiloBoton('rojo', true, 'oscuro').colores).toEqual(['#17304F'])
})
test('oscuro: deshabilitado', () => {
  const e = estiloBoton('azul', false, 'oscuro')
  expect(e.colores).toEqual(['#1A2638'])
  expect(e.titulo).toBe('#5B6B80')
})
