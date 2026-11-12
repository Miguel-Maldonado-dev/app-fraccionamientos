import type { SupabaseClient } from '@supabase/supabase-js'
import type { RoleName } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

export type DatosAltaUsuario = {
  fraccionamientoId: number
  rol: RoleName
  nombre: string
  email: string
  password: string
}

export type ResultadoAltaUsuario = { ok: true; id: string } | { ok: false; motivo: 'email_duplicado' | 'error' }

/**
 * Da de alta un usuario con el cliente service role: crea la cuenta en auth (email confirmado) y
 * su perfil. Si el perfil no se puede crear, borra la cuenta para no dejar usuarios huérfanos.
 */
export async function altaUsuario(
  admin: SupabaseClient<Database>,
  datos: DatosAltaUsuario,
): Promise<ResultadoAltaUsuario> {
  const { fraccionamientoId, rol, nombre, email, password } = datos

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) {
    // Supabase Auth también responde 422 en otros casos (p. ej. weak_password); un 422 sin code
    // solo se toma como duplicado para versiones antiguas de Supabase Auth.
    if (error && (error.code === 'email_exists' || (error.code == null && error.status === 422))) {
      return { ok: false, motivo: 'email_duplicado' }
    }
    console.error('altaUsuario: no se pudo crear el usuario en auth', error)
    return { ok: false, motivo: 'error' }
  }

  const id = data.user.id
  const { error: insertError } = await admin
    .from('perfiles')
    .insert({ id, fraccionamiento_id: fraccionamientoId, rol, nombre, email })
  if (!insertError) return { ok: true, id }

  console.error('altaUsuario: no se pudo crear el perfil', insertError)
  const { error: deleteError } = await admin.auth.admin.deleteUser(id)
  if (deleteError) {
    console.error(`altaUsuario: no se pudo borrar el usuario de auth ${id} tras fallar el perfil`, deleteError)
  }
  return { ok: false, motivo: 'error' }
}
