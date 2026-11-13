import type { SupabaseClient } from '@supabase/supabase-js'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import type { Database } from '@/lib/supabase/types'
import { MSG_ERROR_CUENTA, MSG_PASSWORD_CORTA } from './messages'
import { correoSintetico } from './telefono'

/*
 * Cuentas de residente (app móvil). No es `'use server'`: recibe el cliente service-role y no
 * verifica rol; quien lo llame debe haber validado antes el acceso con el cliente del usuario.
 */
type Admin = SupabaseClient<Database>

export const PASSWORD_MIN = 8
/** Duración del ban al desactivar una cuenta (~100 años): Supabase Auth no tiene ban permanente. */
const BAN_INDEFINIDO = '876000h'

export function passwordValida(password: string): boolean {
  return password.length >= PASSWORD_MIN
}

export type ResultadoCuenta =
  | { ok: true; userId: string; creada: boolean }
  | { ok: false; motivo: 'password_requerida' | 'password_invalida' | 'error' }

/**
 * Busca la cuenta por teléfono (ya normalizado). Si existe, la reactiva (sin tocar su contraseña);
 * si no, la crea con la contraseña dada. Si el registro en `cuentas_residente` falla, borra el
 * usuario de Auth para no dejarlo huérfano.
 */
export async function obtenerOCrearCuenta(
  admin: Admin,
  { telefono, password }: { telefono: string; password?: string },
): Promise<ResultadoCuenta> {
  const { data: existente, error: buscarError } = await admin
    .from('cuentas_residente')
    .select('user_id, activo')
    .eq('telefono', telefono)
    .maybeSingle()
  if (buscarError) {
    console.error('obtenerOCrearCuenta: no se pudo buscar la cuenta', buscarError)
    return { ok: false, motivo: 'error' }
  }

  if (existente) {
    const userId = existente.user_id
    if (!existente.activo) {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
      if (banError) {
        console.error(`obtenerOCrearCuenta: no se pudo quitar el ban de ${userId}`, banError)
        return { ok: false, motivo: 'error' }
      }
      const { error } = await admin.from('cuentas_residente').update({ activo: true }).eq('user_id', userId)
      if (error) {
        console.error(`obtenerOCrearCuenta: no se pudo reactivar ${userId}`, error)
        return { ok: false, motivo: 'error' }
      }
    }
    return { ok: true, userId, creada: false }
  }

  if (!password) return { ok: false, motivo: 'password_requerida' }
  if (!passwordValida(password)) return { ok: false, motivo: 'password_invalida' }

  const { data, error } = await admin.auth.admin.createUser({
    email: correoSintetico(telefono),
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    if (error?.code === 'weak_password') return { ok: false, motivo: 'password_invalida' }
    console.error('obtenerOCrearCuenta: no se pudo crear el usuario en auth', error)
    return { ok: false, motivo: 'error' }
  }

  const userId = data.user.id
  const { error: insertError } = await admin.from('cuentas_residente').insert({ user_id: userId, telefono })
  if (!insertError) return { ok: true, userId, creada: true }

  console.error('obtenerOCrearCuenta: no se pudo registrar la cuenta', insertError)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error(`obtenerOCrearCuenta: no se pudo borrar el usuario de auth ${userId}`, deleteError)
  }
  return { ok: false, motivo: 'error' }
}

/**
 * Si la cuenta ya no está vinculada a ningún residente, la desactiva y la banea. Supabase no permite
 * cerrar las sesiones de un usuario por id (`auth.admin.signOut` pide su JWT): el ban impide
 * renovar la sesión, y el token de acceso vigente caduca solo.
 */
export async function desactivarSiSinDomicilios(admin: Admin, userId: string): Promise<void> {
  const { count, error } = await admin
    .from('residentes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  if ((count ?? 0) > 0) return

  const { error: updError } = await admin.from('cuentas_residente').update({ activo: false }).eq('user_id', userId)
  if (updError) throw new Error(updError.message)
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_INDEFINIDO })
  if (banError) throw new Error(banError.message)
}

export async function restablecerPassword(admin: Admin, userId: string, password: string): Promise<ActionResult> {
  if (!passwordValida(password)) return fail(MSG_PASSWORD_CORTA)
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) {
    if (error.code === 'weak_password') return fail(MSG_PASSWORD_CORTA)
    console.error(`restablecerPassword: no se pudo cambiar la contraseña de ${userId}`, error)
    return fail(MSG_ERROR_CUENTA)
  }
  return ok(undefined)
}
