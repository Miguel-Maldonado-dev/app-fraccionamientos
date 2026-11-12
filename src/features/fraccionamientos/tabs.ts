// Fuera del componente cliente para que la página (Server Component) pueda leer el arreglo.
export const TABS_FRACCIONAMIENTO = ['domicilios', 'usuarios', 'accesos', 'cobro'] as const

export type TabFraccionamiento = (typeof TABS_FRACCIONAMIENTO)[number]

export const ETIQUETA_TAB: Record<TabFraccionamiento, string> = {
  domicilios: 'Domicilios',
  usuarios: 'Usuarios',
  accesos: 'Accesos',
  cobro: 'Reglas de cobro',
}
