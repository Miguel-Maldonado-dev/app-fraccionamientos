'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runSuperAdminAction } from '@/lib/auth/run-action'
import { encolar } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import type { TareaNueva } from '@/features/sincronizacion/tipos'
import { createClient } from '@/lib/supabase/server'
import { MSG_FRACCIONAMIENTO_NO_EXISTE } from './messages'

const botonSchema = z.object({
  boton: z.number().int().min(0).max(3),
  panelId: z.uuid(),
  panelCodigo: z.string().trim().min(1),
  salida: z.number().int().min(0).max(3),
  salidaAlias: z.string(),
})
const botonesSchema = z
  .array(botonSchema)
  .max(4)
  .refine((bs) => new Set(bs.map((b) => b.boton)).size === bs.length, 'Cada botón solo puede tener una salida')

export type BotonInput = z.input<typeof botonSchema>

/**
 * Deja configuradas exactamente `botones` (los botones que no vengan quedan sin salida). Si cambió
 * algún botón y el fraccionamiento tiene instalación, encola `control actualizar` por cada control
 * que lo use, para que access-core reciba las salidas nuevas.
 */
export async function guardarBotonesDeFraccionamiento(
  fraccionamientoId: number,
  botones: BotonInput[],
): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    const parsed = botonesSchema.safeParse(botones)
    if (!parsed.success) return fail(parsed.error.issues[0].message)
    const nuevos = parsed.data

    const supabase = await createClient()
    const { data: fracc, error: errFracc } = await supabase
      .from('fraccionamientos')
      .select('instalacion_id')
      .eq('id', fraccionamientoId)
      .maybeSingle()
    if (errFracc) throw new Error(errFracc.message)
    if (!fracc) return fail(MSG_FRACCIONAMIENTO_NO_EXISTE)

    const { data: existentes, error: errLeer } = await supabase
      .from('fraccionamiento_botones')
      .select('boton, panel_id, panel_codigo, salida, salida_alias')
      .eq('fraccionamiento_id', fraccionamientoId)
    if (errLeer) throw new Error(errLeer.message)
    const actuales = new Map((existentes ?? []).map((f) => [f.boton, f]))

    const aGuardar = nuevos.filter((b) => {
      const a = actuales.get(b.boton)
      return !a || a.panel_id !== b.panelId || a.salida !== b.salida || (a.salida_alias ?? '') !== b.salidaAlias
    })
    const aBorrar = [...actuales.keys()].filter((n) => !nuevos.some((b) => b.boton === n))
    const cambiados = new Set([...aGuardar.map((b) => b.boton), ...aBorrar])
    if (cambiados.size === 0) return ok(undefined)

    // 1) Encolar antes de escribir: si encolar falla no se toca nada; si la escritura falla después,
    //    el trabajador manda las salidas vigentes (las viejas, sin daño) y el reintento vuelve a ver el diff.
    let hayTareas = false
    if (fracc.instalacion_id) {
      const { data: controles, error } = await supabase
        .from('controles_acceso')
        .select('id, domicilio_id, botones')
        .eq('fraccionamiento_id', fraccionamientoId)
      if (error) throw new Error(error.message)
      const tareas: TareaNueva[] = (controles ?? [])
        .filter((c) => ((c.botones ?? []) as { boton: number }[]).some((b) => cambiados.has(b.boton)))
        .map((c) => ({
          fraccionamientoId,
          domicilioId: c.domicilio_id,
          entidad: 'control',
          entidadId: c.id,
          operacion: 'actualizar',
        }))
      if (tareas.length > 0) {
        await encolar(supabase, tareas)
        hayTareas = true
      }
    }

    // 2) Primero el upsert y después el borrado: un fallo deja el conjunto anterior lo más intacto posible.
    if (aGuardar.length > 0) {
      const { error } = await supabase.from('fraccionamiento_botones').upsert(
        aGuardar.map((b) => ({
          fraccionamiento_id: fraccionamientoId,
          boton: b.boton,
          panel_id: b.panelId,
          panel_codigo: b.panelCodigo,
          salida: b.salida,
          salida_alias: b.salidaAlias,
        })),
        { onConflict: 'fraccionamiento_id,boton' },
      )
      if (error) throw new Error(error.message)
    }
    if (aBorrar.length > 0) {
      const { error } = await supabase
        .from('fraccionamiento_botones')
        .delete()
        .eq('fraccionamiento_id', fraccionamientoId)
        .in('boton', aBorrar)
      if (error) throw new Error(error.message)
    }

    if (hayTareas) dispararSincronizacion(fraccionamientoId)

    revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}`)
    return ok(undefined)
  })
}
