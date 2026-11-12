import { describe, expect, test } from 'vitest'
import { avisoMediosOcultos, contarRegistrosQueSeOcultan } from './medios-ocultos'

describe('contarRegistrosQueSeOcultan', () => {
  const registros = { tarjeta: 2, control: 1 }

  test('cuenta los registros de los medios visibles que el tipo nuevo quita', () => {
    expect(contarRegistrosQueSeOcultan(registros, ['tarjeta', 'control'], ['telefono'])).toEqual({ tarjetas: 2, controles: 1 })
    expect(contarRegistrosQueSeOcultan(registros, ['tarjeta', 'control'], ['tarjeta'])).toEqual({ tarjetas: 0, controles: 1 })
  })

  test('lo que ya estaba oculto no cuenta', () => {
    expect(contarRegistrosQueSeOcultan(registros, ['telefono'], [])).toEqual({ tarjetas: 0, controles: 0 })
  })
})

describe('avisoMediosOcultos', () => {
  test.each([
    [{ tarjetas: 2, controles: 1 }, 'Se ocultarán 2 tarjetas y 1 control y se darán de baja en access-core'],
    [{ tarjetas: 1, controles: 2 }, 'Se ocultarán 1 tarjeta y 2 controles y se darán de baja en access-core'],
    [{ tarjetas: 3, controles: 0 }, 'Se ocultarán 3 tarjetas y se darán de baja en access-core'],
    [{ tarjetas: 0, controles: 1 }, 'Se ocultará 1 control y se dará de baja en access-core'],
  ])('%j', (conteo, texto) => {
    expect(avisoMediosOcultos(conteo)).toBe(texto)
  })

  test('sin registros no hay aviso', () => {
    expect(avisoMediosOcultos({ tarjetas: 0, controles: 0 })).toBeNull()
  })
})
