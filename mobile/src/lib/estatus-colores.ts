import type { Esquema, Paleta } from './tema'

export type ColorChip = { fondo: string; texto: string }

function coloresEstatus(colores: Paleta, esquema: Esquema): Record<string, ColorChip> {
  const oscuro = esquema === 'oscuro'
  return {
    Pagado: { fondo: colores.exitoSuave, texto: colores.exito },
    Pendiente: { fondo: colores.azulSuave, texto: colores.primario },
    'En gracia': oscuro ? { fondo: '#3A2E12', texto: '#F0B84D' } : { fondo: '#FFF6E5', texto: '#9A6200' },
    Vencido: { fondo: colores.errorSuave, texto: colores.error },
  }
}

/** Chip neutro (Cancelada y cualquier estatus desconocido). */
export function colorChipEstatus(estatus: string, colores: Paleta, esquema: Esquema): ColorChip {
  return coloresEstatus(colores, esquema)[estatus] ?? { fondo: colores.borde, texto: colores.secundario }
}
