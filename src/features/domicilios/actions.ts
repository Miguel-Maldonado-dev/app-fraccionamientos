'use server'

import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { revalidar } from '@/features/accesos/revalidar'
import { ROLES } from '@/lib/constants'
import { MSG_ACCESO_YA_EN_ESTADO } from './messages'
import { actualizarDomicilioEn, crearDomicilioEn } from './mutaciones'
import type { DomicilioInput } from './schemas'

export async function crearDomicilio(input: DomicilioInput): Promise<ActionResult<{ id: number }>> {
  return runAction([ROLES.ADMINISTRADOR], (user) => crearDomicilioEn(null, user.id, input))
}

export async function actualizarDomicilio(id: number, input: DomicilioInput): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], () => actualizarDomicilioEn(null, id, input))
}

/** Ajuste manual de acceso: 'activo' | 'inactivo' | null (quitar el ajuste). Solo administrador. */
export async function forzarAcceso(domicilioId: number, valor: 'activo' | 'inactivo' | null): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], async () => {
    if (valor !== null && valor !== 'activo' && valor !== 'inactivo') return fail('Valor de acceso no válido.')
    const supabase = await createClient()
    const { error } = await supabase.rpc('forzar_acceso', {
      p_domicilio_id: domicilioId,
      // La función acepta null para quitar el ajuste; el tipo generado no lo refleja.
      p_valor: valor as string,
    })
    if (error) {
      if (error.code === 'P0001') return fail(MSG_ACCESO_YA_EN_ESTADO)
      throw new Error(error.message)
    }
    const inst = await instalacionDe(supabase, null)
    if (inst) dispararSincronizacion(inst.fid)
    revalidar(null, domicilioId)
    return ok(undefined)
  })
}
