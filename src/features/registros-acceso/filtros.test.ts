import { describe, expect, it } from 'vitest'
import { filtrosAParams, leerFiltros, MSG_RANGO_INVERTIDO, MSG_RANGO_MAXIMO } from './filtros'

const HOY = '2026-11-13'

describe('leerFiltros', () => {
  it('por omisión hoy–hoy, página 1', () => {
    expect(leerFiltros({}, HOY)).toEqual({ filtros: { desde: HOY, hasta: HOY, pagina: 1 }, error: null })
  })
  it('31 días permitido; 32 días ⇒ error y reinicio', () => {
    expect(leerFiltros({ desde: '2026-10-14', hasta: HOY }, HOY).error).toBeNull()
    expect(leerFiltros({ desde: '2026-10-13', hasta: HOY, origen: '1' }, HOY)).toEqual({
      filtros: { desde: HOY, hasta: HOY, pagina: 1 },
      error: MSG_RANGO_MAXIMO,
    })
  })
  it('desde > hasta ⇒ error', () => {
    expect(leerFiltros({ desde: '2026-11-14', hasta: HOY }, HOY).error).toBe(MSG_RANGO_INVERTIDO)
  })
  it('valores inválidos se normalizan', () => {
    const { filtros, error } = leerFiltros(
      { desde: 'abc', hasta: '2026-02-30', origen: '9', pagina: '0', resultado: 'x', domicilio: '-3', panel: '<x>' },
      HOY,
    )
    expect(error).toBeNull()
    expect(filtros).toEqual({ desde: HOY, hasta: HOY, pagina: 1 })
  })
  it('lee filtros válidos (arreglos toman el primero)', () => {
    const { filtros } = leerFiltros(
      { desde: '2026-11-01', hasta: HOY, domicilio: '7', panel: 'p-1', resultado: 'denegado', origen: ['4', '2'], pagina: '3' },
      HOY,
    )
    expect(filtros).toEqual({
      desde: '2026-11-01', hasta: HOY, domicilio: 7, panel: 'p-1', resultado: 'denegado', origen: '4', pagina: 3,
    })
  })
})

describe('filtrosAParams', () => {
  it('omite vacíos y página 1, ida y vuelta', () => {
    expect(filtrosAParams({ desde: HOY, hasta: HOY, pagina: 1 }).toString()).toBe('desde=2026-11-13&hasta=2026-11-13')
    const f = { desde: '2026-11-01', hasta: HOY, domicilio: 7, panel: 'p', resultado: 'permitido' as const, origen: '0' as const, pagina: 2 }
    expect(leerFiltros(Object.fromEntries(filtrosAParams(f)), HOY).filtros).toEqual(f)
  })
})
