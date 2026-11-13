import type { Estilo } from './schemas'

export type EstiloInfo = {
  etiqueta: string
  fondo: string
  degradado?: [string, string]
  titulo: string
  icono: string
  chip: string
  flecha: string
}

/** Paleta de los botones de la app (spec §4.2). */
export const ESTILO_INFO: Record<Estilo, EstiloInfo> = {
  azul: {
    etiqueta: 'Azul',
    fondo: '#087BE8',
    degradado: ['#087BE8', '#0FB5D8'],
    titulo: '#FFFFFF',
    icono: '#FFFFFF',
    chip: 'rgba(255,255,255,0.22)',
    flecha: '#FFFFFF',
  },
  azul_claro: {
    etiqueta: 'Azul claro',
    fondo: '#E6F1FD',
    titulo: '#071F49',
    icono: '#087BE8',
    chip: '#CFE3FA',
    flecha: '#087BE8',
  },
  navy: {
    etiqueta: 'Navy',
    fondo: '#071F49',
    degradado: ['#071F49', '#0B3270'],
    titulo: '#FFFFFF',
    icono: '#FFFFFF',
    chip: 'rgba(255,255,255,0.18)',
    flecha: '#FFFFFF',
  },
  turquesa: {
    etiqueta: 'Turquesa claro',
    fondo: '#DDF6F8',
    titulo: '#071F49',
    icono: '#0B9DB8',
    chip: '#C3EDF1',
    flecha: '#0B9DB8',
  },
}
