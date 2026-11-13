/** Paleta de los botones de acceso; idéntica a src/features/app-botones/estilos.ts (web). */
export type EstiloBoton = { colores: string[]; titulo: string; icono: string; chip: string; flecha: string }

const ESTILOS: Record<string, EstiloBoton> = {
  azul: { colores: ['#087BE8', '#0FB5D8'], titulo: '#FFFFFF', icono: '#FFFFFF', chip: 'rgba(255,255,255,0.22)', flecha: '#FFFFFF' },
  azul_claro: { colores: ['#E6F1FD'], titulo: '#071F49', icono: '#087BE8', chip: '#CFE3FA', flecha: '#087BE8' },
  navy: { colores: ['#071F49', '#0B3270'], titulo: '#FFFFFF', icono: '#FFFFFF', chip: 'rgba(255,255,255,0.18)', flecha: '#FFFFFF' },
  turquesa: { colores: ['#DDF6F8'], titulo: '#071F49', icono: '#0B9DB8', chip: '#C3EDF1', flecha: '#0B9DB8' },
}

const DESHABILITADO: EstiloBoton = { colores: ['#EEF2F6'], titulo: '#B8C4D0', icono: '#B8C4D0', chip: '#E2E8EF', flecha: '#B8C4D0' }

/** En oscuro: azul y navy iguales; azul_claro y turquesa cambian (spec modo oscuro). */
const ESTILOS_OSCUROS: Record<string, EstiloBoton> = {
  ...ESTILOS,
  azul_claro: { colores: ['#17304F'], titulo: '#E6EDF5', icono: '#6CB6FF', chip: '#21406A', flecha: '#6CB6FF' },
  turquesa: { colores: ['#123D45'], titulo: '#E6EDF5', icono: '#4FD1E0', chip: '#1A525C', flecha: '#4FD1E0' },
}

const DESHABILITADO_OSCURO: EstiloBoton = { colores: ['#1A2638'], titulo: '#5B6B80', icono: '#5B6B80', chip: '#22324D', flecha: '#5B6B80' }

/** Estilo desconocido o ausente ⇒ azul_claro; deshabilitado ⇒ gris sin degradado. */
export function estiloBoton(estilo: string | undefined, habilitado: boolean, esquema: 'claro' | 'oscuro' = 'claro'): EstiloBoton {
  const oscuro = esquema === 'oscuro'
  if (!habilitado) return oscuro ? DESHABILITADO_OSCURO : DESHABILITADO
  const tabla = oscuro ? ESTILOS_OSCUROS : ESTILOS
  return estilo && Object.hasOwn(tabla, estilo) ? tabla[estilo] : tabla.azul_claro
}
