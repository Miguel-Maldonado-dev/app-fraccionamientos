'use server'

import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES_GESTION } from '@/lib/constants'
import type { Tables } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import {
  MSG_CUOTA_DUPLICADA,
  MSG_CUOTA_NO_EXISTE,
  MSG_SIN_CONCEPTO,
  MSG_SOLO_PENDIENTES,
} from './messages'
import {
  getCuotaInfo,
  getDescuentoCuota,
  getRecargoCuota,
  type CuotaInfo,
} from './queries'
import { estatusVisible } from './estatus'
import { periodoSchema } from './schemas'

// --- Generación masiva ---

export async function generarCuotas(input: { anio: number; mes: number }): Promise<ActionResult> {
  const parsed = periodoSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { anio, mes } = parsed.data

  return runAction(ROLES_GESTION, async () => {
    const supabase = await createClient()
    const { error } = await supabase.rpc('generar_cuotas', { p_anio: anio, p_mes: mes })
    if (error) return fail('No fue posible generar las cuotas: ' + error.message)

    revalidatePath('/cuotas')
    return ok(undefined)
  })
}

// --- Cuota individual y ajustes ---

function revalidar(domicilioId: number) {
  revalidatePath(`/domicilios/${domicilioId}`)
  revalidatePath('/cuotas')
}

/** Solo las cuotas Pendiente, En gracia o Vencido admiten cambios en sus descuentos y recargos. */
function esEditable(cuota: CuotaInfo): boolean {
  const estatus = estatusVisible(cuota)
  return estatus === 'Pendiente' || estatus === 'En gracia' || estatus === 'Vencido'
}

export async function generarCuotaDomicilio(
  domicilioId: number,
  input: { anio: number; mes: number },
): Promise<ActionResult> {
  const parsed = periodoSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { anio, mes } = parsed.data

  return runAction(ROLES_GESTION, async () => {
    const supabase = await createClient()
    const { error } = await supabase.rpc('generar_cuota_domicilio', {
      p_domicilio_id: domicilioId,
      p_anio: anio,
      p_mes: mes,
    })
    if (error) {
      if (error.code === 'P0001' && error.message === 'La cuota ya existe') return fail(MSG_CUOTA_DUPLICADA)
      if (error.code === 'P0001' && error.message === 'El domicilio no tiene tipo de cuota') return fail(MSG_SIN_CONCEPTO)
      throw new Error(error.message)
    }

    revalidar(domicilioId)
    return ok(undefined)
  })
}

export async function obtenerAjustesCuota(
  cuotaId: number,
): Promise<ActionResult<{ descuento: Tables<'descuento_cuota'> | null; recargo: Tables<'recargo_cuota'> | null }>> {
  return runAction(null, async () => {
    const supabase = await createClient()
    const [descuento, recargo] = await Promise.all([
      getDescuentoCuota(supabase, cuotaId),
      getRecargoCuota(supabase, cuotaId),
    ])
    return ok({ descuento, recargo })
  })
}

export async function editarCuota(
  cuotaId: number,
  domicilioId: number,
  input: { conceptoDescuentoId?: number; conceptoRecargoId?: number },
): Promise<ActionResult> {
  return runAction(ROLES_GESTION, async () => {
    const supabase = await createClient()
    const cuota = await getCuotaInfo(supabase, cuotaId)
    if (!cuota) return fail(MSG_CUOTA_NO_EXISTE)
    if (!esEditable(cuota)) return fail(MSG_SOLO_PENDIENTES)

    if (input.conceptoDescuentoId && !(await getDescuentoCuota(supabase, cuotaId))) {
      const { error } = await supabase
        .from('descuento_cuota')
        .insert({ cuota_id: cuotaId, concepto_descuento_id: input.conceptoDescuentoId })
      if (error) throw new Error(error.message)
    }
    if (input.conceptoRecargoId && !(await getRecargoCuota(supabase, cuotaId))) {
      const { error } = await supabase
        .from('recargo_cuota')
        .insert({ cuota_id: cuotaId, concepto_recargo_id: input.conceptoRecargoId })
      if (error) throw new Error(error.message)
    }

    revalidar(domicilioId)
    return ok(undefined)
  })
}

export async function eliminarDescuento(id: number, domicilioId: number): Promise<ActionResult> {
  return runAction(ROLES_GESTION, async () => {
    const supabase = await createClient()
    const { data: row, error: rowError } = await supabase
      .from('descuento_cuota')
      .select('cuota_id')
      .eq('id', id)
      .maybeSingle()
    if (rowError) throw new Error(rowError.message)
    if (!row) return fail(MSG_CUOTA_NO_EXISTE)
    const cuota = await getCuotaInfo(supabase, row.cuota_id)
    if (!cuota) return fail(MSG_CUOTA_NO_EXISTE)
    if (!esEditable(cuota)) return fail(MSG_SOLO_PENDIENTES)

    const { error } = await supabase.from('descuento_cuota').delete().eq('id', id)
    if (error) throw new Error(error.message)
    revalidar(domicilioId)
    return ok(undefined)
  })
}

export async function eliminarRecargo(id: number, domicilioId: number): Promise<ActionResult> {
  return runAction(ROLES_GESTION, async () => {
    const supabase = await createClient()
    const { data: row, error: rowError } = await supabase
      .from('recargo_cuota')
      .select('cuota_id')
      .eq('id', id)
      .maybeSingle()
    if (rowError) throw new Error(rowError.message)
    if (!row) return fail(MSG_CUOTA_NO_EXISTE)
    const cuota = await getCuotaInfo(supabase, row.cuota_id)
    if (!cuota) return fail(MSG_CUOTA_NO_EXISTE)
    if (!esEditable(cuota)) return fail(MSG_SOLO_PENDIENTES)

    const { error } = await supabase.from('recargo_cuota').delete().eq('id', id)
    if (error) throw new Error(error.message)
    revalidar(domicilioId)
    return ok(undefined)
  })
}
