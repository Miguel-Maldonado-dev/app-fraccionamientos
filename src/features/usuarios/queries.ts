import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Views } from '@/lib/supabase/types'

export async function listUsuarios(
  supabase: SupabaseClient<Database>,
  activos: boolean,
  fraccionamientoId?: number,
): Promise<Views<'users_info'>[]> {
  let query = supabase.from('users_info').select('*').eq('is_active', activos)
  // En la app, RLS ya limita al propio fraccionamiento; la consola del super admin filtra aquí.
  if (fraccionamientoId !== undefined) query = query.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los usuarios: ${error.message}`)
  return data ?? []
}
