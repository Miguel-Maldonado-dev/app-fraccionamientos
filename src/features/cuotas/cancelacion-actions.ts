'use server'

import { revalidatePath } from 'next/cache'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES, type RoleName } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { MSG_CUOTA_NO_CANCELADA, MSG_CUOTAS_NO_CANCELABLES } from './messages'
import { cancelarCuotasSchema } from './schemas'

const ROLES_CANCELACION: RoleName[] = [ROLES.ADMINISTRADOR]

type ErrorRpc = { code?: string; message: string }

function revalidar(domicilioId: number) {
  revalidatePath(`/domicilios/${domicilioId}`)
  revalidatePath('/cuotas')
}

/** El RPC ya recalculó los permisos y encoló; aquí solo se procesa la cola. Un fallo no tumba la acción. */
async function dispararResincronizacion(supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  try {
    const inst = await instalacionDe(supabase, null)
    if (inst) dispararSincronizacion(inst.fid)
  } catch (e) {
    console.error(`No se pudo disparar la sincronización tras la cancelación: ${e instanceof Error ? e.message : e}`)
  }
}

/** Mensajes estáticos que lanzan cancelar_cuotas / reactivar_cuota y que son seguros de mostrar. */
const MENSAJES_RPC = new Set([
  'No tienes permiso para cancelar cuotas',
  'No tienes permiso para reactivar cuotas',
  'El motivo debe tener entre 3 y 500 caracteres',
  'Selecciona al menos una cuota',
  'Alguna cuota no existe o no pertenece al fraccionamiento',
  'Las cuotas deben ser de un mismo domicilio',
  'Solo se pueden cancelar cuotas sin pago y no canceladas',
  'La cuota no existe',
  'La cuota no está cancelada',
])

/** Errores de negocio (22023 / P0001): solo se muestran los mensajes conocidos; el resto, el fallback. Otros códigos se relanzan. */
function mensajeDe(error: ErrorRpc, fallback: string): string {
  if (error.code === 'P0001' || error.code === '22023') return MENSAJES_RPC.has(error.message) ? error.message : fallback
  throw new Error(error.message)
}

export async function cancelarCuotas(
  domicilioId: number,
  cuotaIds: number[],
  motivo: string,
): Promise<ActionResult<{ canceladas: number }>> {
  const parsed = cancelarCuotasSchema.safeParse({ domicilioId, cuotaIds, motivo })
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  return runAction(ROLES_CANCELACION, async () => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('cancelar_cuotas', {
      p_cuota_ids: parsed.data.cuotaIds,
      p_motivo: parsed.data.motivo,
    })
    if (error) return fail(mensajeDe(error, MSG_CUOTAS_NO_CANCELABLES))

    revalidar(parsed.data.domicilioId)
    await dispararResincronizacion(supabase)
    return ok({ canceladas: data ?? parsed.data.cuotaIds.length })
  })
}

export async function reactivarCuota(domicilioId: number, cuotaId: number): Promise<ActionResult> {
  if (!Number.isInteger(domicilioId) || domicilioId < 1 || !Number.isInteger(cuotaId) || cuotaId < 1) {
    return fail(MSG_CUOTA_NO_CANCELADA)
  }

  return runAction(ROLES_CANCELACION, async () => {
    const supabase = await createClient()
    const { error } = await supabase.rpc('reactivar_cuota', { p_cuota_id: cuotaId })
    if (error) return fail(mensajeDe(error, MSG_CUOTA_NO_CANCELADA))

    revalidar(domicilioId)
    await dispararResincronizacion(supabase)
    return ok(undefined)
  })
}
