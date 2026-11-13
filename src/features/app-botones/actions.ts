'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runSuperAdminAction } from '@/lib/auth/run-action'
import { listarSalidas } from '@/lib/access-core'
import { createClient } from '@/lib/supabase/server'
import { MSG_FRACCIONAMIENTO_NO_EXISTE } from '@/features/fraccionamientos/messages'
import {
  MSG_ACCESS_CORE,
  MSG_BOTON_NO_EXISTE,
  MSG_MAXIMO_BOTONES,
  MSG_ORDEN_INVALIDO,
  MSG_SALIDA_NO_EXISTE,
  MSG_SIN_INSTALACION,
} from './messages'
import { botonSchema, MAX_BOTONES, type BotonInput } from './schemas'

const idSchema = z.number().int().positive()

const ruta = (id: number) => `/admin/fraccionamientos/${id}`

/** Crea (sin `id`) o edita un botón de la app; copia el alias de la salida desde access-core. */
export async function guardarBoton(
  fraccionamientoId: number,
  input: BotonInput & { id?: number },
): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    const parsed = botonSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0].message)
    if (input.id !== undefined && !idSchema.safeParse(input.id).success) return fail(MSG_BOTON_NO_EXISTE)
    const b = parsed.data

    const supabase = await createClient()
    const { data: fracc, error: errFracc } = await supabase
      .from('fraccionamientos')
      .select('instalacion_id')
      .eq('id', fraccionamientoId)
      .maybeSingle()
    if (errFracc) throw new Error(errFracc.message)
    if (!fracc) return fail(MSG_FRACCIONAMIENTO_NO_EXISTE)

    let salidaNombre: string | null = null
    if (b.salidaId) {
      if (!fracc.instalacion_id) return fail(MSG_SIN_INSTALACION)
      let salidas
      try {
        salidas = await listarSalidas(fracc.instalacion_id)
      } catch (error) {
        console.error(error)
        return fail(MSG_ACCESS_CORE)
      }
      const s = salidas.find((x) => x.id === b.salidaId)
      if (!s) return fail(MSG_SALIDA_NO_EXISTE)
      salidaNombre = s.alias || `Salida ${s.output_index + 1}`
    }

    const campos = {
      nombre: b.nombre,
      icono: b.icono,
      estilo: b.estilo,
      ancho_completo: b.anchoCompleto,
      salida_id: b.salidaId,
      salida_nombre: salidaNombre,
    }

    if (input.id !== undefined) {
      const { data, error } = await supabase
        .from('app_botones')
        .update(campos)
        .eq('id', input.id)
        .eq('fraccionamiento_id', fraccionamientoId)
        .select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return fail(MSG_BOTON_NO_EXISTE)
    } else {
      const { data: actuales, error: errLeer } = await supabase
        .from('app_botones')
        .select('orden')
        .eq('fraccionamiento_id', fraccionamientoId)
      if (errLeer) throw new Error(errLeer.message)
      const usados = new Set((actuales ?? []).map((a) => a.orden))
      if (usados.size >= MAX_BOTONES) return fail(MSG_MAXIMO_BOTONES)
      // Siempre al final: el primer orden libre después del mayor (o el primer hueco si no cabe).
      const mayor = Math.max(0, ...usados)
      let orden = mayor + 1
      if (orden > MAX_BOTONES) orden = [1, 2, 3, 4, 5, 6, 7, 8].find((n) => !usados.has(n))!
      const { error } = await supabase
        .from('app_botones')
        .insert({ fraccionamiento_id: fraccionamientoId, orden, ...campos })
      if (error) {
        if (error.code === '23514' || error.code === '23505') return fail(MSG_MAXIMO_BOTONES)
        throw new Error(error.message)
      }
    }

    revalidatePath(ruta(fraccionamientoId))
    return ok(undefined)
  })
}

export async function eliminarBoton(fraccionamientoId: number, id: number): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    if (!idSchema.safeParse(id).success) return fail(MSG_BOTON_NO_EXISTE)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_botones')
      .delete()
      .eq('id', id)
      .eq('fraccionamiento_id', fraccionamientoId)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return fail(MSG_BOTON_NO_EXISTE)
    revalidatePath(ruta(fraccionamientoId))
    return ok(undefined)
  })
}

/** Reasigna `orden` 1..n según `ids` (RPC con el único diferido, sin estados intermedios inválidos). */
export async function reordenarBotones(fraccionamientoId: number, ids: number[]): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    const parsed = z.array(idSchema).max(MAX_BOTONES).safeParse(ids)
    if (!parsed.success || new Set(ids).size !== ids.length) return fail(MSG_ORDEN_INVALIDO)
    const supabase = await createClient()
    const { error } = await supabase.rpc('reordenar_app_botones', {
      p_fraccionamiento_id: fraccionamientoId,
      p_ids: parsed.data,
    })
    if (error) {
      if (error.code === '22023') return fail(MSG_ORDEN_INVALIDO)
      throw new Error(error.message)
    }
    revalidatePath(ruta(fraccionamientoId))
    return ok(undefined)
  })
}
