export type Origen = '0' | '1' | '2' | '3' | '4' | '5'

export type Filtros = {
  desde: string
  hasta: string
  domicilio?: number
  panel?: string
  resultado?: 'permitido' | 'denegado'
  origen?: Origen
  pagina: number
}

export const MAX_DIAS = 31
export const MSG_RANGO_MAXIMO = 'El rango máximo es de 31 días'
export const MSG_RANGO_INVERTIDO = 'La fecha inicial debe ser anterior a la final'

type SearchParams = Record<string, string | string[] | undefined>

const ORIGENES_VALIDOS: readonly string[] = ['0', '1', '2', '3', '4', '5']
const ID_PANEL = /^[\w-]{1,64}$/

function uno(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  return s?.trim() || undefined
}

/** Días desde época para `aaaa-mm-dd` válido; `null` si la fecha no existe o está mal formada. */
function diaDe(s: string | undefined): number | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null
  if (!m) return null
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = Date.UTC(a, mes - 1, d)
  const f = new Date(t)
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null
  return t / 86_400_000
}

function enteroPositivo(s: string | undefined): number | undefined {
  if (!s || !/^\d+$/.test(s)) return undefined
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : undefined
}

/**
 * Lee los filtros de la URL. Los valores inválidos se descartan (fechas ⇒ `hoy`, página ⇒ 1).
 * Un rango invertido o mayor a 31 días devuelve `error` y reinicia los filtros a hoy–hoy.
 */
export function leerFiltros(sp: SearchParams, hoy: string): { filtros: Filtros; error: string | null } {
  const desdeRaw = uno(sp.desde)
  const hastaRaw = uno(sp.hasta)
  const desde = diaDe(desdeRaw) != null ? desdeRaw! : hoy
  const hasta = diaDe(hastaRaw) != null ? hastaRaw! : hoy
  const dDesde = diaDe(desde)!
  const dHasta = diaDe(hasta)!

  let error: string | null = null
  if (dDesde > dHasta) error = MSG_RANGO_INVERTIDO
  else if (dHasta - dDesde + 1 > MAX_DIAS) error = MSG_RANGO_MAXIMO
  if (error) return { filtros: { desde: hoy, hasta: hoy, pagina: 1 }, error }

  const filtros: Filtros = { desde, hasta, pagina: enteroPositivo(uno(sp.pagina)) ?? 1 }
  const domicilio = enteroPositivo(uno(sp.domicilio))
  if (domicilio) filtros.domicilio = domicilio
  const panel = uno(sp.panel)
  if (panel && ID_PANEL.test(panel)) filtros.panel = panel
  const resultado = uno(sp.resultado)
  if (resultado === 'permitido' || resultado === 'denegado') filtros.resultado = resultado
  const origen = uno(sp.origen)
  if (origen && ORIGENES_VALIDOS.includes(origen)) filtros.origen = origen as Origen
  return { filtros, error: null }
}

/** Filtros a query string (omite vacíos y la página 1). */
export function filtrosAParams(f: Filtros): URLSearchParams {
  const p = new URLSearchParams()
  p.set('desde', f.desde)
  p.set('hasta', f.hasta)
  if (f.domicilio != null) p.set('domicilio', String(f.domicilio))
  if (f.panel) p.set('panel', f.panel)
  if (f.resultado) p.set('resultado', f.resultado)
  if (f.origen) p.set('origen', f.origen)
  if (f.pagina > 1) p.set('pagina', String(f.pagina))
  return p
}
