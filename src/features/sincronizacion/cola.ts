import type { SupabaseClient } from '@supabase/supabase-js'
import { getTenantContext } from '@/lib/auth/tenant-context'
import type { Database } from '@/lib/supabase/database.types'
import type { TareaNueva } from './tipos'

/**
 * Inserta las tareas en la cola con un solo `insert`. Con arreglo vacío no llama a la base.
 *
 * La política de inserción valida cada fila: para `tarjeta` y `control`, `entidad_id` debe ser una
 * fila existente del fraccionamiento, así que una tarea `borrar` se encola ANTES de borrar la fila local.
 */
export async function encolar(supabase: SupabaseClient<Database>, tareas: TareaNueva[]): Promise<void> {
  if (tareas.length === 0) return
  const { error } = await supabase.from('sincronizaciones_acceso').insert(
    tareas.map((t) => ({
      fraccionamiento_id: t.fraccionamientoId,
      domicilio_id: t.domicilioId,
      entidad: t.entidad,
      entidad_id: t.entidadId,
      operacion: t.operacion,
      carga: (t.carga ?? {}) as never,
    })),
  )
  if (error) throw new Error(error.message)
}

/** Id del fraccionamiento (el dado o el del usuario) y su instalación; `null` si no tiene instalación. */
export async function instalacionDe(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
): Promise<{ fid: number; instalacionId: string } | null> {
  const fid = fraccionamientoId ?? (await getTenantContext())?.fraccionamiento?.id
  if (fid == null) return null
  const { data, error } = await supabase.from('fraccionamientos').select('instalacion_id').eq('id', fid).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.instalacion_id ? { fid, instalacionId: data.instalacion_id } : null
}

/** Encola solo si el fraccionamiento tiene instalación de Access Core; devuelve si encoló. */
export async function encolarSiHayInstalacion(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
  tareas: (fid: number) => TareaNueva[],
): Promise<boolean> {
  const inst = await instalacionDe(supabase, fraccionamientoId)
  if (!inst) return false
  await encolar(supabase, tareas(inst.fid))
  return true
}

/** Recalcula los permisos de acceso del fraccionamiento; devuelve cuántos cambiaron. */
export async function recalcularPermisos(supabase: SupabaseClient<Database>, fraccionamientoId: number): Promise<number> {
  const { data, error } = await supabase.rpc('recalcular_permisos_acceso', { p_fraccionamiento_id: fraccionamientoId })
  if (error) throw new Error(error.message)
  return data ?? 0
}
