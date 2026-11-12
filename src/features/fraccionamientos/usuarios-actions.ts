'use server'

import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runSuperAdminAction } from '@/lib/auth/run-action'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { altaUsuario } from '@/features/usuarios/alta'
import { mensajeAltaFallida } from '@/features/usuarios/mensaje-alta'
import { nuevoUsuarioSchema, type NuevoUsuarioInput } from '@/features/usuarios/schemas'
import { MSG_FRACCIONAMIENTO_NO_EXISTE, MSG_USUARIO_NO_EXISTE } from './messages'
import { getFraccionamiento } from './queries'

const rutaDetalle = (fraccionamientoId: number) => `/admin/fraccionamientos/${fraccionamientoId}`

/** Alta de un usuario (cualquier rol de fraccionamiento) desde la consola del super admin. */
export async function crearUsuarioEnFraccionamiento(
  fraccionamientoId: number,
  input: NuevoUsuarioInput,
): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    const parsed = nuevoUsuarioSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0].message)
    const { userName, email, password, rol } = parsed.data

    const supabase = await createClient()
    if (!(await getFraccionamiento(supabase, fraccionamientoId))) return fail(MSG_FRACCIONAMIENTO_NO_EXISTE)

    // El super admin no puede insertar perfiles (`authenticated` no tiene INSERT en perfiles, aunque la política RLS perfiles_insert lo permitiría) y crear el usuario de auth requiere el service role de todos modos.
    const resultado = await altaUsuario(createAdminClient(), {
      fraccionamientoId,
      rol,
      nombre: userName,
      email,
      password,
    })
    if (!resultado.ok) return fail(mensajeAltaFallida(resultado.motivo))

    revalidatePath(rutaDetalle(fraccionamientoId))
    return ok(undefined)
  })
}

/** Activa o desactiva un usuario del fraccionamiento indicado (RLS permite al super admin `perfiles.activo`). */
export async function cambiarEstadoUsuarioEnFraccionamiento(
  fraccionamientoId: number,
  usuarioId: string,
  activo: boolean,
): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('perfiles')
      .update({ activo })
      .eq('id', usuarioId)
      .eq('fraccionamiento_id', fraccionamientoId)
      .select('id')
    if (error) throw new Error(error.message)
    if ((data ?? []).length === 0) return fail(MSG_USUARIO_NO_EXISTE)

    revalidatePath(rutaDetalle(fraccionamientoId))
    return ok(undefined)
  })
}
