import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Tables } from '@/lib/supabase/types'

export async function listControles(
  supabase: SupabaseClient<Database>,
  domicilioId: number,
): Promise<Tables<'controles_acceso'>[]> {
  const { data, error } = await supabase
    .from('controles_acceso')
    .select('*')
    .eq('domicilio_id', domicilioId)
    .order('id', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los controles de acceso: ${error.message}`)
  return data ?? []
}

/**
 * Botones (0..3) con salida configurada en el fraccionamiento: los únicos que se ofrecen al capturar
 * un control. `null` = el fraccionamiento del usuario (RLS); la consola pasa el id explícito.
 */
export async function listBotonesConfigurados(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number | null,
): Promise<number[]> {
  let q = supabase.from('fraccionamiento_botones').select('boton')
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.order('boton', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los botones configurados: ${error.message}`)
  return (data ?? []).map((f) => f.boton)
}
