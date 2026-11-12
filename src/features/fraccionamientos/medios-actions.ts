'use server'

import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runSuperAdminAction } from '@/lib/auth/run-action'
import { MEDIOS_HABILITABLES, type MedioAcceso } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { MSG_MEDIO_EN_USO, MSG_MEDIO_NO_DISPONIBLE } from './messages'

/**
 * Deja habilitados exactamente `medios`. Borra solo los que sobran e inserta solo los que faltan:
 * borrar todo y reinsertar chocaría con el trigger de "medio en uso" aunque el medio se conserve.
 */
export async function guardarMediosDeFraccionamiento(
  fraccionamientoId: number,
  medios: MedioAcceso[],
): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    const nuevos = [...new Set(medios)]
    if (nuevos.some((m) => !MEDIOS_HABILITABLES.includes(m))) return fail(MSG_MEDIO_NO_DISPONIBLE)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fraccionamiento_medios')
      .select('medio')
      .eq('fraccionamiento_id', fraccionamientoId)
    if (error) throw new Error(error.message)
    const actuales = (data ?? []).map((f) => f.medio as MedioAcceso)

    const sobran = actuales.filter((m) => !nuevos.includes(m))
    const faltan = nuevos.filter((m) => !actuales.includes(m))

    if (sobran.length > 0) {
      const { error: errBorrar } = await supabase
        .from('fraccionamiento_medios')
        .delete()
        .eq('fraccionamiento_id', fraccionamientoId)
        .in('medio', sobran)
      if (errBorrar) {
        if (errBorrar.code === '23503') return fail(MSG_MEDIO_EN_USO)
        throw new Error(errBorrar.message)
      }
    }
    if (faltan.length > 0) {
      const { error: errInsertar } = await supabase
        .from('fraccionamiento_medios')
        .insert(faltan.map((medio) => ({ fraccionamiento_id: fraccionamientoId, medio })))
      if (errInsertar) throw new Error(errInsertar.message)
    }

    revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}`)
    return ok(undefined)
  })
}
