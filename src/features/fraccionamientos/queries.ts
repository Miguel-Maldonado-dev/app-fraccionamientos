import type { SupabaseClient } from '@supabase/supabase-js'
import type { MedioAcceso } from '@/lib/constants'
import type { Database } from '@/lib/supabase/database.types'

export type FraccionamientoResumen = {
  id: number
  nombre: string
  slug: string
  activo: boolean
  instalacionId: string | null
  instalacionNombre: string | null
  usuarios: number
  domicilios: number
}

const SELECT = 'id, nombre, slug, activo, instalacion_id, instalacion_nombre, perfiles(count), domicilios(count)'

type Conteo = { count: number }[] | { count: number } | null
type Fila = {
  id: number
  nombre: string
  slug: string
  activo: boolean
  instalacion_id: string | null
  instalacion_nombre: string | null
  perfiles: Conteo
  domicilios: Conteo
}

/** PostgREST devuelve `relacion(count)` como `[{ count }]`. */
function contar(rel: Conteo): number {
  const fila = Array.isArray(rel) ? rel[0] : rel
  return fila?.count ?? 0
}

function aResumen(r: Fila): FraccionamientoResumen {
  return {
    id: r.id,
    nombre: r.nombre,
    slug: r.slug,
    activo: r.activo,
    instalacionId: r.instalacion_id,
    instalacionNombre: r.instalacion_nombre,
    usuarios: contar(r.perfiles),
    domicilios: contar(r.domicilios),
  }
}

/** Todos los fraccionamientos (RLS: solo el super admin los ve todos), con usuarios y domicilios. */
export async function listFraccionamientos(supabase: SupabaseClient<Database>): Promise<FraccionamientoResumen[]> {
  const { data, error } = await supabase
    .from('fraccionamientos')
    .select(SELECT)
    .order('nombre', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los fraccionamientos: ${error.message}`)
  return ((data ?? []) as unknown as Fila[]).map(aResumen)
}

export async function getFraccionamiento(
  supabase: SupabaseClient<Database>,
  id: number,
): Promise<FraccionamientoResumen | null> {
  const { data, error } = await supabase.from('fraccionamientos').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(`No se pudo leer el fraccionamiento: ${error.message}`)
  return data ? aResumen(data as unknown as Fila) : null
}

export type BotonConfig = { boton: 0 | 1 | 2 | 3; panelId: string; panelCodigo: string; salida: 0 | 1 | 2 | 3; salidaAlias: string }

export async function listMedios(supabase: SupabaseClient<Database>, fraccionamientoId: number): Promise<MedioAcceso[]> {
  const { data, error } = await supabase
    .from('fraccionamiento_medios')
    .select('medio')
    .eq('fraccionamiento_id', fraccionamientoId)
  if (error) throw new Error(`No se pudieron leer los medios: ${error.message}`)
  return (data ?? []).map((f) => f.medio as MedioAcceso)
}

export async function listBotones(supabase: SupabaseClient<Database>, fraccionamientoId: number): Promise<BotonConfig[]> {
  const { data, error } = await supabase
    .from('fraccionamiento_botones')
    .select('boton, panel_id, panel_codigo, salida, salida_alias')
    .eq('fraccionamiento_id', fraccionamientoId)
    .order('boton', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los botones: ${error.message}`)
  return (data ?? []).map((f) => ({
    boton: f.boton as BotonConfig['boton'],
    panelId: f.panel_id,
    panelCodigo: f.panel_codigo,
    salida: f.salida as BotonConfig['salida'],
    salidaAlias: f.salida_alias ?? '',
  }))
}

/** Ids de las instalaciones que ya están vinculadas a algún fraccionamiento. */
export async function listInstalacionesEnUso(supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await supabase.from('fraccionamientos').select('instalacion_id').not('instalacion_id', 'is', null)
  if (error) throw new Error(`No se pudieron leer las instalaciones en uso: ${error.message}`)
  return (data ?? []).map((f) => f.instalacion_id as string)
}
