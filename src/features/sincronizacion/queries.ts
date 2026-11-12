import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Entidad, EstadoSync, Tarea } from './tipos'

/** Estado de la última tarea de una entidad; `tareaId` sirve para reintentarla. */
export type EstadoEntidad = { estado: EstadoSync; error: string | null; tareaId: string }

type FilaEstado = { id: string; entidad_id: number | null; estado: string; ultimo_error: string | null }

async function filasDeEstado(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
  entidad: Entidad,
  filtrar: (q: ReturnType<ReturnType<typeof base>['select']>) => ReturnType<ReturnType<typeof base>['select']>,
): Promise<FilaEstado[]> {
  let q = filtrar(base(supabase).select('id, entidad_id, estado, ultimo_error, created_at')).eq('entidad', entidad)
  if (fraccionamientoId != null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as FilaEstado[]
}

const base = (supabase: SupabaseClient<Database>) => supabase.from('sincronizaciones_acceso')

/**
 * Modo consola (superadmin): las tareas `asignar` reflejan el estado de pago del domicilio, que la
 * consola no debe revelar. Se excluyen del estado del domicilio y se oculta su `ultimo_error`.
 */
export type OpcionesConsulta = { consola?: boolean }

const aEstado = (f: FilaEstado): EstadoEntidad => ({ estado: f.estado as EstadoSync, error: f.ultimo_error, tareaId: f.id })

/** Última tarea por `entidad_id`. */
export async function estadoDeEntidades(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
  entidad: Entidad,
  ids: number[],
): Promise<Map<number, EstadoEntidad>> {
  const mapa = new Map<number, EstadoEntidad>()
  if (ids.length === 0) return mapa
  const filas = await filasDeEstado(supabase, fraccionamientoId, entidad, (q) => q.in('entidad_id', ids))
  for (const f of filas) {
    if (f.entidad_id != null && !mapa.has(f.entidad_id)) mapa.set(f.entidad_id, aEstado(f))
  }
  return mapa
}

/** Última tarea (de cualquier operación) de la entidad `domicilio`. */
export async function estadoDomicilio(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
  domicilioId: number,
  opciones: OpcionesConsulta = {},
): Promise<EstadoEntidad | null> {
  const filas = await filasDeEstado(supabase, fraccionamientoId, 'domicilio', (q) => {
    const conDomicilio = q.eq('domicilio_id', domicilioId)
    return opciones.consola ? conDomicilio.neq('operacion', 'asignar') : conDomicilio
  })
  return filas[0] ? aEstado(filas[0]) : null
}

/**
 * Tareas no `ok` con la dirección del domicilio. `domicilio_id` no tiene FK, así que PostgREST no
 * puede embeber: se consultan las direcciones de los domicilios distintos en una segunda consulta.
 */
export async function listTareasAbiertas(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
  opciones: OpcionesConsulta = {},
): Promise<(Tarea & { direccion: string | null })[]> {
  let q = base(supabase).select('*').neq('estado', 'ok')
  if (fraccionamientoId != null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const tareas = (data ?? []).map((t) =>
    opciones.consola && t.operacion === 'asignar' ? { ...t, ultimo_error: null } : t,
  )

  const ids = [...new Set(tareas.map((t) => t.domicilio_id).filter((id): id is number => id != null))]
  const direcciones = new Map<number, string>()
  if (ids.length > 0) {
    const { data: doms, error: errDoms } = await supabase.from('domicilios').select('id, direccion').in('id', ids)
    if (errDoms) throw new Error(errDoms.message)
    for (const d of doms ?? []) direcciones.set(d.id, d.direccion)
  }
  return tareas.map((t) => ({ ...t, direccion: t.domicilio_id != null ? (direcciones.get(t.domicilio_id) ?? null) : null }))
}

export async function resumenSincronizacion(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
): Promise<{ pendientes: number; errores: number; ultimaOk: string | null }> {
  const contar = async (estado: EstadoSync) => {
    let q = base(supabase).select('id', { count: 'exact', head: true }).eq('estado', estado)
    if (fraccionamientoId != null) q = q.eq('fraccionamiento_id', fraccionamientoId)
    const { count, error } = await q
    if (error) throw new Error(error.message)
    return count ?? 0
  }
  const pendientes = contar('pendiente')
  const errores = contar('error')
  let ultima = base(supabase).select('updated_at').eq('estado', 'ok')
  if (fraccionamientoId != null) ultima = ultima.eq('fraccionamiento_id', fraccionamientoId)
  const [nPendientes, nErrores, { data, error }] = await Promise.all([
    pendientes,
    errores,
    ultima.order('updated_at', { ascending: false }).limit(1),
  ])
  if (error) throw new Error(error.message)
  return { pendientes: nPendientes, errores: nErrores, ultimaOk: data?.[0]?.updated_at ?? null }
}
