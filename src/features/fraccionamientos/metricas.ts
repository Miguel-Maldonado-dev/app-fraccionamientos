import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type MetricasFraccionamiento = {
  id: number
  nombre: string
  activo: boolean
  domicilios: number
  residentes: number
  usuariosActivos: number
  tarjetas: number
  telefonos: number
}

const SELECT =
  'id, nombre, activo, domicilios(count), residentes(count), tarjetas_acceso(count), telefonos_acceso(count), usuarios_activos:perfiles(count)'

type Conteo = { count: number }[] | { count: number } | null
type Fila = {
  id: number
  nombre: string
  activo: boolean
  domicilios: Conteo
  residentes: Conteo
  tarjetas_acceso: Conteo
  telefonos_acceso: Conteo
  usuarios_activos: Conteo
}

/** PostgREST devuelve `relacion(count)` como `[{ count }]`. */
function contar(rel: Conteo): number {
  const fila = Array.isArray(rel) ? rel[0] : rel
  return fila?.count ?? 0
}

/** Conteos por fraccionamiento en una sola consulta (RLS: solo el super admin los ve todos). */
export async function listMetricasFraccionamientos(
  supabase: SupabaseClient<Database>,
): Promise<MetricasFraccionamiento[]> {
  const { data, error } = await supabase
    .from('fraccionamientos')
    .select(SELECT)
    // El filtro sobre el alias limita solo el conteo embebido de perfiles.
    .eq('usuarios_activos.activo' as never, true)
    .order('nombre', { ascending: true })
  if (error) throw new Error(`No se pudieron leer las métricas: ${error.message}`)
  return ((data ?? []) as unknown as Fila[]).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    activo: r.activo,
    domicilios: contar(r.domicilios),
    residentes: contar(r.residentes),
    usuariosActivos: contar(r.usuarios_activos),
    tarjetas: contar(r.tarjetas_acceso),
    telefonos: contar(r.telefonos_acceso),
  }))
}

export function totalesPlataforma(rows: MetricasFraccionamiento[]) {
  const suma = (f: (r: MetricasFraccionamiento) => number) => rows.reduce((acc, r) => acc + f(r), 0)
  return {
    fraccionamientos: rows.length,
    activos: rows.filter((r) => r.activo).length,
    domicilios: suma((r) => r.domicilios),
    residentes: suma((r) => r.residentes),
    usuariosActivos: suma((r) => r.usuariosActivos),
    tarjetas: suma((r) => r.tarjetas),
    telefonos: suma((r) => r.telefonos),
  }
}
