import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/**
 * PIN guardado del domicilio, o `null` si no tiene. Solo para administrador, tesorero y super admin:
 * para comité y vigilancia RLS devuelve 0 filas (indistinguible de "sin PIN"), así que no se llama.
 */
export async function getPinDomicilio(supabase: SupabaseClient<Database>, domicilioId: number): Promise<string | null> {
  const { data, error } = await supabase.from('pines_acceso').select('pin').eq('domicilio_id', domicilioId).maybeSingle()
  if (error) throw new Error(`No se pudo leer el PIN: ${error.message}`)
  return data?.pin ?? null
}

/** Si el domicilio ya existe en access-core (tiene `titular_id`): sin él no se puede gestionar el PIN. */
export async function domicilioSincronizado(supabase: SupabaseClient<Database>, domicilioId: number): Promise<boolean> {
  const { data, error } = await supabase.from('domicilios').select('titular_id').eq('id', domicilioId).maybeSingle()
  if (error) throw new Error(`No se pudo leer el domicilio: ${error.message}`)
  return !!data?.titular_id
}
