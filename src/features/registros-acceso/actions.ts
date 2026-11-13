'use server'

import { AccessCoreError, listarLogs, listarPaneles } from '@/lib/access-core'
import { requireRole, requireSuperAdmin } from '@/lib/auth/require-role'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { ROLES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { filtrosAParams, leerFiltros, type Filtros } from './filtros'
import {
  MSG_DEMASIADAS,
  MSG_ERROR_REGISTROS,
  MSG_FILTROS_INVALIDOS,
  MSG_NO_AUTORIZADO,
  MSG_SIN_INSTALACION,
} from './messages'
import { fechaHoraMexico, traducirLog, type FilaRegistro } from './traduccion'

export type ResultadoRegistros =
  | { ok: true; filas: FilaRegistro[]; total: number; pagina: number; paginas: number; meta?: MetaExport }
  | { ok: false; error: string; sinInstalacion?: boolean }

export type OpcionesRegistros = {
  domicilios: { id: number; direccion: string }[]
  paneles: { id: string; panel_code: string }[]
}

/** Datos del encabezado de la exportación; viajan con la primera página de `paginaExport`. */
export type MetaExport = { fraccionamiento: string; generadoPor: string; generadoEn: string }

const POR_PAGINA = 50
const MAX_ESPERA_MS = 10_000

/**
 * Los filtros llegan del cliente: se validan otra vez con las mismas reglas que la URL (formato,
 * desde ≤ hasta, 31 días, catálogos). Devuelve el mensaje de error o los filtros normalizados.
 */
function validarFiltros(filtros: Filtros): { filtros: Filtros; error: string | null } {
  if (!filtros || typeof filtros !== 'object') return { filtros: filtros, error: MSG_FILTROS_INVALIDOS }
  try {
    const base = { ...filtros, pagina: 1 }
    const esperado = filtrosAParams(base).toString()
    // Fecha de respaldo imposible de confundir: una fecha mal formada cae a ella y deja de coincidir.
    const r = leerFiltros(Object.fromEntries(filtrosAParams(base)), '1970-01-01')
    if (r.error) return r
    // Cualquier valor descartado (formato, catálogo) cambia la consulta: se rechaza en lugar de ampliarla.
    if (filtrosAParams(r.filtros).toString() !== esperado) return { filtros: r.filtros, error: MSG_FILTROS_INVALIDOS }
    return { filtros: { ...r.filtros, pagina: filtros.pagina }, error: null }
  } catch {
    return { filtros, error: MSG_FILTROS_INVALIDOS }
  }
}

/**
 * Fraccionamiento autorizado: `null` ⇒ el del administrador en sesión; un número ⇒ solo super admin
 * (un administrador que manda un id, aunque sea el suyo, queda rechazado). `null` si no autorizado.
 */
async function fraccionamientoAutorizado(fraccionamientoId: number | null): Promise<number | null> {
  try {
    if (fraccionamientoId == null) return (await requireRole(ROLES.ADMINISTRADOR)).fraccionamientoId
    if (!Number.isSafeInteger(fraccionamientoId) || fraccionamientoId <= 0) return null
    await requireSuperAdmin()
    return fraccionamientoId
  } catch {
    return null
  }
}

async function domiciliosConTitular(supabase: Awaited<ReturnType<typeof createClient>>, fid: number) {
  const { data, error } = await supabase
    .from('domicilios')
    .select('id, direccion, titular_id')
    .eq('fraccionamiento_id', fid)
    .not('titular_id', 'is', null)
    .order('direccion', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).filter((d): d is typeof d & { titular_id: string } => d.titular_id != null)
}

export async function consultarRegistros(
  fraccionamientoId: number | null,
  filtros: Filtros,
): Promise<ResultadoRegistros> {
  const fid = await fraccionamientoAutorizado(fraccionamientoId)
  if (fid == null) return { ok: false, error: MSG_NO_AUTORIZADO }
  const v = validarFiltros(filtros)
  if (v.error) return { ok: false, error: v.error }
  return consultar(fid, v.filtros, false)
}

async function consultar(fid: number, filtros: Filtros, reintentar429: boolean): Promise<ResultadoRegistros> {
  try {
    const supabase = await createClient()
    const inst = await instalacionDe(supabase, fid)
    if (!inst) return { ok: false, sinInstalacion: true, error: MSG_SIN_INSTALACION }

    const domicilios = await domiciliosConTitular(supabase, fid)
    let titular: string | undefined
    if (filtros.domicilio != null) {
      titular = domicilios.find((d) => d.id === filtros.domicilio)?.titular_id
      // Domicilio ajeno o sin titular: no hay registros que mostrar.
      if (!titular) return { ok: true, filas: [], total: 0, pagina: 1, paginas: 0 }
    }

    const pagina = Math.max(1, Math.trunc(Number(filtros.pagina)) || 1)
    const consulta = {
      desde: filtros.desde,
      hasta: filtros.hasta,
      panel: filtros.panel,
      titular,
      resultado: filtros.resultado,
      origen: filtros.origen,
      pagina,
    }
    let r
    try {
      r = await listarLogs(inst.instalacionId, consulta)
    } catch (error) {
      if (!reintentar429 || !(error instanceof AccessCoreError) || error.status !== 429) throw error
      // Exportación: respeta Retry-After (máx. 10 s) y reintenta una sola vez.
      const espera = Math.min(MAX_ESPERA_MS, Math.max(0, (error.retryAfter ?? 1) * 1000))
      await new Promise((ok) => setTimeout(ok, espera))
      r = await listarLogs(inst.instalacionId, consulta)
    }
    const mapa = new Map(domicilios.map((d) => [d.titular_id, d.direccion]))
    return {
      ok: true,
      filas: r.data.map((l) => traducirLog(l, mapa)),
      total: r.total,
      pagina: r.page ?? pagina,
      paginas: Math.ceil(r.total / POR_PAGINA),
    }
  } catch (error) {
    if (error instanceof AccessCoreError && error.status === 429) return { ok: false, error: MSG_DEMASIADAS }
    console.error(error)
    return { ok: false, error: MSG_ERROR_REGISTROS }
  }
}

/**
 * Una página para la exportación: misma autorización y validación que `consultarRegistros`; ante un
 * 429 espera `Retry-After` (máx. 10 s) y reintenta una vez. La página 1 trae además `meta`.
 */
export async function paginaExport(
  fraccionamientoId: number | null,
  filtros: Filtros,
  pagina: number,
): Promise<ResultadoRegistros> {
  const fid = await fraccionamientoAutorizado(fraccionamientoId)
  if (fid == null) return { ok: false, error: MSG_NO_AUTORIZADO }
  const v = validarFiltros({ ...filtros, pagina })
  if (v.error) return { ok: false, error: v.error }
  const n = Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1
  if (n !== 1) return consultar(fid, { ...v.filtros, pagina: n }, true)
  const [r, meta] = await Promise.all([consultar(fid, { ...v.filtros, pagina: 1 }, true), metaExport(fid)])
  return r.ok ? { ...r, meta } : r
}

async function metaExport(fid: number): Promise<MetaExport> {
  const generadoEn = fechaHoraMexico(new Date())
  try {
    const supabase = await createClient()
    const [ctx, { data }] = await Promise.all([
      getTenantContext(),
      supabase.from('fraccionamientos').select('nombre').eq('id', fid).maybeSingle(),
    ])
    return {
      fraccionamiento: data?.nombre || `Fraccionamiento ${fid}`,
      generadoPor: ctx?.perfil?.nombre || ctx?.email || '—',
      generadoEn,
    }
  } catch {
    return { fraccionamiento: `Fraccionamiento ${fid}`, generadoPor: '—', generadoEn }
  }
}

/** Opciones de los filtros: domicilios con titular y paneles de la instalación. Vacías si no autorizado o error. */
export async function opcionesRegistros(fraccionamientoId: number | null): Promise<OpcionesRegistros> {
  const vacio: OpcionesRegistros = { domicilios: [], paneles: [] }
  const fid = await fraccionamientoAutorizado(fraccionamientoId)
  if (fid == null) return vacio

  try {
    const supabase = await createClient()
    const [doms, inst] = await Promise.all([domiciliosConTitular(supabase, fid), instalacionDe(supabase, fid)])
    const domicilios = doms.map(({ id, direccion }) => ({ id, direccion }))
    if (!inst) return { domicilios, paneles: [] }
    try {
      const paneles = await listarPaneles(inst.instalacionId)
      return { domicilios, paneles: paneles.map(({ id, panel_code }) => ({ id, panel_code })) }
    } catch (error) {
      console.error(error)
      return { domicilios, paneles: [] }
    }
  } catch (error) {
    console.error(error)
    return vacio
  }
}
