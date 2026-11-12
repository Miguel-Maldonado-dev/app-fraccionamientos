'use server'

import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES } from '@/lib/constants'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { altaUsuario } from './alta'
import { mensajeAltaFallida } from './mensaje-alta'
import { MSG_NO_AUTO_CAMBIAR_ROL, MSG_NO_AUTO_DESACTIVAR } from './messages'
import {
  editarUsuarioSchema,
  nuevoUsuarioSchema,
  type EditarUsuarioInput,
  type NuevoUsuarioInput,
} from './schemas'

export async function crearUsuario(input: NuevoUsuarioInput): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], async (user) => {
    const parsed = nuevoUsuarioSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0].message)
    const { userName, email, password, rol } = parsed.data

    const resultado = await altaUsuario(createAdminClient(), {
      // runAction solo ejecuta con usuarios activos de un fraccionamiento activo.
      fraccionamientoId: user.fraccionamientoId!,
      rol,
      nombre: userName,
      email,
      password,
    })
    if (!resultado.ok) return fail(mensajeAltaFallida(resultado.motivo))

    revalidatePath('/usuarios')
    return ok(undefined)
  })
}

export async function actualizarUsuario(id: string, input: EditarUsuarioInput): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], async (user) => {
    const parsed = editarUsuarioSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0].message)
    const { userName, rol } = parsed.data
    if (id === user.id && rol !== user.roleName) return fail(MSG_NO_AUTO_CAMBIAR_ROL)

    const supabase = await createClient()
    const { error } = await supabase.from('perfiles').update({ nombre: userName, rol }).eq('id', id)
    if (error) throw new Error(error.message)

    revalidatePath('/usuarios')
    return ok(undefined)
  })
}

export async function cambiarEstadoUsuario(id: string, activo: boolean): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], async (user) => {
    if (!activo && id === user.id) return fail(MSG_NO_AUTO_DESACTIVAR)

    const supabase = await createClient()
    const { error } = await supabase.from('perfiles').update({ activo }).eq('id', id)
    if (error) throw new Error(error.message)

    revalidatePath('/usuarios')
    return ok(undefined)
  })
}
