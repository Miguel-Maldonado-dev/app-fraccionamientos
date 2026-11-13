import { distribucion } from './botones'
const m = { ancho_completo: false }
const c = { ancho_completo: true }

describe('distribucion', () => {
  test('vacío', () => expect(distribucion([])).toEqual([]))
  test('1 botón ocupa toda la fila', () => expect(distribucion([m])).toEqual(['completo']))
  test('3 botones: el último se estira', () => expect(distribucion([m, m, m])).toEqual(['mitad', 'mitad', 'completo']))
  test('4 botones: todos a la mitad', () =>
    expect(distribucion([m, m, m, m])).toEqual(['mitad', 'mitad', 'mitad', 'mitad']))
  test('[completo, mitad, mitad]: ninguno estirado', () =>
    expect(distribucion([c, m, m])).toEqual(['completo', 'mitad', 'mitad']))
  test('[mitad, completo, mitad]: cada mitad queda sola', () =>
    expect(distribucion([m, c, m])).toEqual(['completo', 'completo', 'completo']))
})
