import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Tables, Views } from '@/lib/supabase/types'

export async function listResidentesDomicilio(
  supabase: SupabaseClient<Database>,
  domicilioId: number,
): Promise<Tables<'residentes'>[]> {
  const { data, error } = await supabase
    .from('residentes')
    .select('*')
    .eq('domicilio_id', domicilioId)
    .order('id', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los residentes: ${error.message}`)
  return data ?? []
}

/** Residente con la dirección de su domicilio (para la pantalla Residentes, con acciones). */
export type ResidenteConDomicilio = Tables<'residentes'> & { direccion: string | null }

export async function listResidentesConDomicilio(
  supabase: SupabaseClient<Database>,
  domicilioId?: number,
): Promise<ResidenteConDomicilio[]> {
  let query = supabase.from('residentes').select('*, domicilios(direccion)')
  if (domicilioId !== undefined) query = query.eq('domicilio_id', domicilioId)
  const { data, error } = await query.order('id', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los residentes: ${error.message}`)
  return (data ?? [])
    .map(({ domicilios, ...r }) => ({
      ...r,
      direccion: (domicilios as { direccion: string } | null)?.direccion ?? null,
    }))
    .sort((a, b) => (a.direccion ?? '').localeCompare(b.direccion ?? '', 'es', { numeric: true }) || a.id - b.id)
}

export async function listResidentesInfo(
  supabase: SupabaseClient<Database>,
  domicilioId?: number,
): Promise<Views<'residentes_info'>[]> {
  let query = supabase.from('residentes_info').select('*')
  if (domicilioId !== undefined) query = query.eq('domicilio_id', domicilioId)
  const { data, error } = await query
    .order('direccion', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los residentes: ${error.message}`)
  return data ?? []
}

/** Máximo de residentes con acceso a la app por domicilio del fraccionamiento del usuario (RLS). */
export async function getMaxResidentesApp(supabase: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await supabase.from('fraccionamientos').select('max_residentes_app').maybeSingle()
  if (error) throw new Error(`No se pudo leer el máximo de residentes con app: ${error.message}`)
  return data?.max_residentes_app ?? 5
}

export type DispositivoLigado = { user_id: string; nombre: string | null; ligado_en: string }

/** Dispositivos ligados de las cuentas dadas; RLS limita a administrador y tesorero del fraccionamiento. */
export async function listDispositivos(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<DispositivoLigado[]> {
  if (userIds.length === 0) return []
  const { data, error } = await supabase
    .from('dispositivos_residente')
    .select('user_id, nombre, ligado_en')
    .in('user_id', userIds)
  if (error) throw new Error(`No se pudieron leer los dispositivos: ${error.message}`)
  return data ?? []
}
