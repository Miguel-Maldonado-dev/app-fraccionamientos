import { colorChipEstatus } from './estatus-colores'
import { paletaClara, paletaOscura } from './tema'

test.each([
  ['claro', paletaClara],
  ['oscuro', paletaOscura],
] as const)('Cancelada y desconocidos usan chip neutro (%s)', (esquema, paleta) => {
  const neutro = { fondo: paleta.borde, texto: paleta.secundario }
  expect(colorChipEstatus('Cancelada', paleta, esquema)).toEqual(neutro)
  expect(colorChipEstatus('Otro', paleta, esquema)).toEqual(neutro)
  expect(colorChipEstatus('Vencido', paleta, esquema)).not.toEqual(neutro)
})
