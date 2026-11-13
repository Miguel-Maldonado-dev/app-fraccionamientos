export const VISTAS_ACCESOS = ['registros', 'sincronizacion'] as const
export type VistaAccesos = (typeof VISTAS_ACCESOS)[number]

/** Lee `?vista=`; por omisión Registros. */
export function vistaAccesos(v: string | string[] | undefined): VistaAccesos {
  const s = Array.isArray(v) ? v[0] : v
  return VISTAS_ACCESOS.find((x) => x === s) ?? 'registros'
}
