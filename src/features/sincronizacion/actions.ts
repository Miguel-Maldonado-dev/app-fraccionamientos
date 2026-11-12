'use server'

import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { MSG_ERROR, runAction, runSuperAdminAction } from '@/lib/auth/run-action'
import { ROLES_GESTION } from '@/lib/constants'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { dispararSincronizacion } from './disparar'
import { procesarSincronizaciones } from './worker'

const RUTA_APP = '/accesos'
const rutaConsola = (fid: number) => `/admin/fraccionamientos/${fid}`

/**
 * `omitido`: otro trabajador tenía el lease del fraccionamiento y no se procesó nada.
 * `noConfigurado`: falta `ACCESS_CORE_API_KEY` y la corrida se detuvo.
 */
export type ResultadoProcesar = {
  omitido: boolean
  procesadas: number
  fallidas: number
  detenidoPor429: boolean
  noConfigurado: boolean
}

async function procesarEn(fraccionamientoId: number, ruta: string): Promise<ActionResult<ResultadoProcesar>> {
  const resumen = await procesarSincronizaciones({ fraccionamientoId })
  revalidatePath(ruta)
  return ok({
    omitido: resumen.omitidos > 0,
    procesadas: resumen.procesadas,
    fallidas: resumen.fallidas,
    detenidoPor429: resumen.detenidoPor429,
    noConfigurado: resumen.noConfigurado === true,
  })
}

/**
 * Vuelve a `pendiente` una tarea no `ok` del fraccionamiento. Primero comprueba con el cliente de
 * sesión (RLS) que el usuario la ve; solo `service_role` puede actualizar la cola.
 */
async function reintentarEn(fraccionamientoId: number, id: string, ruta: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sincronizaciones_acceso')
    .select('id')
    .eq('id', id)
    .eq('fraccionamiento_id', fraccionamientoId)
    .neq('estado', 'ok')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return fail(MSG_ERROR)

  const ahora = new Date().toISOString()
  const { error: errUpd } = await createAdminClient()
    .from('sincronizaciones_acceso')
    .update({ estado: 'pendiente', intentos: 0, proximo_intento_at: ahora, updated_at: ahora })
    .eq('id', id)
  if (errUpd) throw new Error(errUpd.message)

  dispararSincronizacion(fraccionamientoId)
  revalidatePath(ruta)
  return ok(undefined)
}

export async function procesarAhora(): Promise<ActionResult<ResultadoProcesar>> {
  return runAction(ROLES_GESTION, async (user) =>
    user.fraccionamientoId == null ? fail(MSG_ERROR) : procesarEn(user.fraccionamientoId, RUTA_APP),
  )
}

export async function reintentarTarea(id: string): Promise<ActionResult> {
  return runAction(ROLES_GESTION, async (user) =>
    user.fraccionamientoId == null ? fail(MSG_ERROR) : reintentarEn(user.fraccionamientoId, id, RUTA_APP),
  )
}

export async function procesarAhoraEnFraccionamiento(fraccionamientoId: number): Promise<ActionResult<ResultadoProcesar>> {
  return runSuperAdminAction(() => procesarEn(fraccionamientoId, rutaConsola(fraccionamientoId)))
}

export async function reintentarTareaEnFraccionamiento(fraccionamientoId: number, id: string): Promise<ActionResult> {
  return runSuperAdminAction(() => reintentarEn(fraccionamientoId, id, rutaConsola(fraccionamientoId)))
}
