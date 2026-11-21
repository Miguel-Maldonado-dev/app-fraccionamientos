'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCuotaInfo } from '@/features/cuotas/queries'
import { getDomicilioInfo } from '@/features/domicilios/queries'
import { instalacionDe, recalcularPermisos } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { ESTATUS, ROLES_GESTION, TIPO_PAGO } from '@/lib/constants'
import { formatDate } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import {
  MSG_CONCEPTO_INVALIDO,
  MSG_CUOTA_CANCELADA,
  MSG_CUOTA_NO_EXISTE,
  MSG_CUOTA_YA_PAGADA,
  MSG_DOMICILIO_NO_EXISTE,
  MSG_PAGO_SIN_MARCAR,
} from './messages'
import { getConceptoPago, getPagoIdPorCuota } from './queries'
import type { ReciboDatos } from './recibo/datos'
import { pagoCuotaSchema, pagoExtraSchema, type PagoCuotaInput, type PagoExtraInput } from './schemas'

type PagoCuotaResult = { pagoId: number; yaExistia?: boolean }

const SIN_RESIDENTE = 'Sin información'

/** Nombre del fraccionamiento del usuario; dentro de `runAction` siempre hay uno. */
async function nombreFraccionamiento(): Promise<string> {
  const ctx = await getTenantContext()
  return ctx?.fraccionamiento?.nombre ?? ''
}

/**
 * Registra el pago de una cuota con la foto JSON de su recibo (`pagos.recibo`) y la marca como Pagado.
 * No es transaccional (igual que la app original). El movimiento de ingreso lo crea el trigger
 * `trg_pagos_to_movimientos` al insertar en `pagos`. Si la cuota ya tenía un pago, no se inserta otro.
 * El PDF del recibo se genera al abrirlo (`/api/recibos/[pagoId]`).
 */
export async function registrarPagoCuota(input: PagoCuotaInput): Promise<ActionResult<PagoCuotaResult>> {
  const parsed = pagoCuotaSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { cuotaId, fechaPago, metodoPagoId } = parsed.data

  return runAction(ROLES_GESTION, async (user) => {
    const supabase = await createClient()

    const cuota = await getCuotaInfo(supabase, cuotaId)
    if (!cuota || cuota.domicilio_id === null || cuota.importe_cuota === null) {
      return fail(MSG_CUOTA_NO_EXISTE)
    }
    if (cuota.estatus === 'Pagado') return fail(MSG_CUOTA_YA_PAGADA)
    if (cuota.estatus === 'Cancelado' || cuota.estatus_calculado === 'Cancelada') return fail(MSG_CUOTA_CANCELADA)
    const domicilioId = cuota.domicilio_id

    // Un intento previo pudo insertar el pago sin llegar a marcar la cuota: no se duplica.
    const pagoExistente = await getPagoIdPorCuota(supabase, cuotaId)
    if (pagoExistente !== null) {
      return marcarPagadaYRevalidar(supabase, cuotaId, domicilioId, {
        pagoId: pagoExistente,
        yaExistia: true,
      })
    }

    const recargo = Number(cuota.monto_recargo ?? 0)
    const descuento = Number(cuota.monto_descuento ?? 0)
    // importe_base es el precio ACTUAL del concepto; el subtotal sale del importe copiado a la cuota.
    const subtotal = Math.round((Number(cuota.importe_cuota) - recargo + descuento) * 100) / 100
    const recibo: ReciboDatos = {
      v: 1,
      fraccionamiento: await nombreFraccionamiento(),
      direccion: cuota.direccion ?? '',
      residente: cuota.residente_principal || SIN_RESIDENTE,
      concepto: cuota.concepto ?? '',
      ...(cuota.periodo && { periodo: cuota.periodo }),
      ...(cuota.fecha_vencimiento && { fechaVencimiento: formatDate(cuota.fecha_vencimiento) }),
      fechaPago: formatDate(fechaPago),
      subtotal,
      ...(recargo > 0 && { recargo }),
      ...(descuento > 0 && { descuento }),
      total: cuota.importe_cuota,
    }

    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        domicilio_id: domicilioId,
        cuota_id: cuotaId,
        concepto_id: cuota.concepto_id,
        fecha_pago: fechaPago,
        metodo_pago_id: metodoPagoId,
        user_id: user.id,
        importe: cuota.importe_cuota,
        recibo,
      })
      .select('id')
      .single()
    if (pagoError) {
      // Guard de la base (trigger): carrera entre la lectura de la cuota y el insert.
      if (pagoError.code === 'P0001' && /cancelada/i.test(pagoError.message)) return fail(MSG_CUOTA_CANCELADA)
      throw new Error(pagoError.message)
    }

    return marcarPagadaYRevalidar(supabase, cuotaId, domicilioId, { pagoId: pago.id })
  })
}

/**
 * Con la cuota pagada el domicilio puede dejar de ser moroso: se recalcula su permiso en access-core.
 * Un fallo aquí no tumba el pago (ya está registrado): se deja en el log y el cron diario lo recalcula.
 */
async function recalcularPermisosTrasPago(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    const inst = await instalacionDe(supabase, null)
    if (!inst) return
    await recalcularPermisos(supabase, inst.fid)
    dispararSincronizacion(inst.fid)
  } catch (e) {
    console.error(`No se pudieron recalcular los permisos de acceso tras el pago: ${e instanceof Error ? e.message : e}`)
  }
}

/** Pasos 6 y 7: con el pago ya registrado, marca la cuota como Pagado y revalida; nunca lanza. */
async function marcarPagadaYRevalidar(
  supabase: SupabaseClient<Database>,
  cuotaId: number,
  domicilioId: number,
  result: PagoCuotaResult,
): Promise<ActionResult<PagoCuotaResult>> {
  const { error } = await supabase.from('cuotas').update({ estatus_id: ESTATUS.PAGADO }).eq('id', cuotaId)
  if (error) console.error(`No se pudo marcar como pagada la cuota ${cuotaId}: ${error.message}`)
  else await recalcularPermisosTrasPago(supabase)

  revalidatePath(`/domicilios/${domicilioId}`)
  revalidatePath('/cuotas')
  revalidatePath('/pagos')
  revalidatePath('/movimientos')
  revalidatePath('/')
  return error ? fail(MSG_PAGO_SIN_MARCAR) : ok(result)
}

/**
 * Registra un pago extra (concepto único, p. ej. tarjeta de acceso) con la foto JSON de su recibo.
 * No hay cuota: el importe es el del concepto. El movimiento de ingreso lo crea el trigger
 * `trg_pagos_to_movimientos`.
 */
export async function registrarPagoExtra(input: PagoExtraInput): Promise<ActionResult<{ pagoId: number }>> {
  const parsed = pagoExtraSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { domicilioId, conceptoId, fechaPago, metodoPagoId } = parsed.data

  return runAction(ROLES_GESTION, async (user) => {
    const supabase = await createClient()

    const concepto = await getConceptoPago(supabase, conceptoId)
    if (!concepto || concepto.tipo_pago_id !== TIPO_PAGO.EXTRA) return fail(MSG_CONCEPTO_INVALIDO)

    const domicilio = await getDomicilioInfo(supabase, domicilioId)
    if (!domicilio) return fail(MSG_DOMICILIO_NO_EXISTE)

    const recibo: ReciboDatos = {
      v: 1,
      fraccionamiento: await nombreFraccionamiento(),
      direccion: domicilio.direccion ?? '',
      residente: domicilio.residente_principal || SIN_RESIDENTE,
      concepto: concepto.nombre,
      fechaPago: formatDate(fechaPago),
      subtotal: concepto.importe,
      total: concepto.importe,
    }

    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        domicilio_id: domicilioId,
        concepto_id: conceptoId,
        fecha_pago: fechaPago,
        metodo_pago_id: metodoPagoId,
        user_id: user.id,
        importe: concepto.importe,
        recibo,
      })
      .select('id')
      .single()
    if (pagoError) throw new Error(pagoError.message)

    revalidatePath('/pagos')
    revalidatePath(`/domicilios/${domicilioId}`)
    revalidatePath('/movimientos')
    revalidatePath('/')
    return ok({ pagoId: pago.id })
  })
}
