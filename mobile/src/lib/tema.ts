import type { ViewStyle } from 'react-native'

export type Esquema = 'claro' | 'oscuro'

/** Tokens de marca WEADMI (ver docs/marca/identidad.md). */
export const paletaClara = {
  primario: '#087BE8',
  navy: '#071F49',
  fondo: '#F5F8FC',
  superficie: '#FFFFFF',
  borde: '#E8EEF4',
  texto: '#172536',
  secundario: '#496985',
  error: '#C62828',
  deshabilitado: '#B8C4D0',
  azulSuave: '#EAF3FD',
  exito: '#2E9E4F',
  exitoSuave: '#E6F6EA',
  errorSuave: '#FDECEC',
  bordeCampo: '#DCE6F0',
  /** Texto/ícono sobre fondo primario. */
  sobrePrimario: '#FFFFFF',
} as const

export type Paleta = { readonly [K in keyof typeof paletaClara]: string }

/** Paleta oscura (spec 2026-11-17-modo-oscuro-app-movil). */
export const paletaOscura: Paleta = {
  primario: '#3D9BF0',
  navy: '#F2F6FB',
  fondo: '#0A1424',
  superficie: '#13213A',
  borde: '#22324D',
  texto: '#E6EDF5',
  secundario: '#93A7BF',
  error: '#F07B7B',
  deshabilitado: '#5B6B80',
  azulSuave: '#1B3252',
  exito: '#4CC27A',
  exitoSuave: '#163A26',
  errorSuave: '#3A1C22',
  bordeCampo: '#22324D',
  sobrePrimario: '#06111F',
}

export function paletaPara(esquema: Esquema): Paleta {
  return esquema === 'oscuro' ? paletaOscura : paletaClara
}

export const fuentes = {
  titulo: 'Sora_600SemiBold',
  tituloFuerte: 'Sora_700Bold',
  texto: 'Inter_400Regular',
  textoMedio: 'Inter_500Medium',
  textoFuerte: 'Inter_600SemiBold',
} as const

export const espacio = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const
export const radio = { sm: 8, md: 12, lg: 16, xl: 24, pildora: 999 } as const

/** Degradado del botón primario (spec §4.3). */
export const degradadoPrimario = ['#0A8CF0', '#0663D6'] as const

/** Sombra azulada muy suave para tarjetas. */
export const sombra = {
  shadowColor: '#0B4A8F',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const

/** Sombra según esquema: en oscuro casi nula. */
export function sombraPara(esquema: Esquema): ViewStyle {
  if (esquema === 'claro') return sombra
  return { shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }
}

/** Opacidad de las ondas decorativas del fondo. */
export function opacidadOndas(esquema: Esquema): number {
  return esquema === 'oscuro' ? 0.15 : 1
}
