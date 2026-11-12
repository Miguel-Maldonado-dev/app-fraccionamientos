import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/supabase/env'
import type { Database } from '@/lib/supabase/types'

/**
 * Cliente de Supabase con la llave service role: omite RLS. Solo para operaciones de servidor que
 * lo requieren (alta de usuarios). La llave se lee al llamar, no al cargar el módulo.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY. Defínela en .env.local.')
  }
  return createClient<Database>(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
