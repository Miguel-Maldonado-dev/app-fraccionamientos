/** Opciones de filtro: los estatus almacenados más 'En gracia' (calculado), justo después de Pendiente. */
export function conGracia(entrada: string[]): string[] {
  // Las canceladas no se listan en Cuotas, así que su estatus no se ofrece en el filtro.
  const opciones = entrada.filter((o) => o !== 'Cancelado' && o !== 'Cancelada')
  if (opciones.includes('En gracia')) return opciones
  const i = opciones.indexOf('Pendiente')
  return i < 0 ? [...opciones, 'En gracia'] : [...opciones.slice(0, i + 1), 'En gracia', ...opciones.slice(i + 1)]
}

/** Estatus que se muestra de una cuota: el calculado por la vista ('En gracia') o, si falta, el almacenado. */
export function estatusVisible(c: { estatus: string | null; estatus_calculado?: string | null }): string | null {
  return c.estatus_calculado ?? c.estatus
}
