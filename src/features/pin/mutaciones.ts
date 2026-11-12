import { fail, ok, type ActionResult } from '@/lib/action-result'
import { AccessCoreError, AccessCoreNoConfigurado, fijarPin, generarPin, quitarPin } from '@/lib/access-core'
import { createClient } from '@/lib/supabase/server'
import { revalidar } from '@/features/accesos/revalidar'
import { MSG_DOMICILIO_NO_ENCONTRADO } from '@/features/domicilios/messages'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { MSG_ACCESS_CORE_NO_CONFIGURADO, MSG_PIN_SIN_SINCRONIZAR } from './messages'
import { pinSchema } from './schemas'

/*
 * PIN del domicilio: SÍNCRONO, sin cola (el PIN generado tiene que volver y un repetido debe
 * rechazarse al instante). Primero se llama a access-core y solo si responde bien se escribe
 * `pines_acceso`. El PIN nunca va a la cola, a los registros ni a los mensajes de error.
 * `fraccionamientoId` es `null` en el fraccionamiento (RLS) y explícito en la consola.
 */
type Fraccionamiento = number | null
type Supabase = Awaited<ReturnType<typeof createClient>>
type Destino = { supabase: Supabase; fid: number; instalacionId: string; titularId: string }

/** Titular e instalación del domicilio, o el `fail` que corresponde. */
async function destino(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
): Promise<{ ok: true; destino: Destino } | { ok: false; error: string }> {
  const supabase = await createClient()
  let q = supabase.from('domicilios').select('titular_id, fraccionamiento_id').eq('id', domicilioId)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data: dom, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  if (!dom) return fail(MSG_DOMICILIO_NO_ENCONTRADO)
  if (!dom.titular_id) return fail(MSG_PIN_SIN_SINCRONIZAR)
  const inst = await instalacionDe(supabase, dom.fraccionamiento_id)
  if (!inst) return fail(MSG_PIN_SIN_SINCRONIZAR)
  return {
    ok: true,
    destino: { supabase, fid: dom.fraccionamiento_id, instalacionId: inst.instalacionId, titularId: dom.titular_id },
  }
}

/** Errores conocidos de access-core → mensaje para el usuario; lo demás se propaga. */
function errorDeApi(e: unknown): { ok: false; error: string } {
  if (e instanceof AccessCoreNoConfigurado) return fail(MSG_ACCESS_CORE_NO_CONFIGURADO)
  if (e instanceof AccessCoreError) return fail(e.message)
  throw e
}

async function guardarPin(d: Destino, domicilioId: number, pin: string) {
  const { error } = await d.supabase
    .from('pines_acceso')
    .upsert(
      { domicilio_id: domicilioId, fraccionamiento_id: d.fid, pin, actualizado_at: new Date().toISOString() },
      { onConflict: 'domicilio_id' },
    )
  // Solo el mensaje de Postgres (nunca la fila, que lleva el PIN).
  if (error) throw new Error(`No se pudo guardar el PIN: ${error.message}`)
}

export async function fijarPinEn(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
  pin: string,
): Promise<ActionResult> {
  const parsed = pinSchema.safeParse(pin)
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const r = await destino(fraccionamientoId, domicilioId)
  if (!r.ok) return r
  try {
    await fijarPin(r.destino.instalacionId, r.destino.titularId, parsed.data)
  } catch (e) {
    return errorDeApi(e)
  }
  await guardarPin(r.destino, domicilioId, parsed.data)

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

/** Pide a access-core un PIN nuevo; lo guarda y lo devuelve para entregarlo al residente. */
export async function generarPinEn(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
): Promise<ActionResult<{ pin: string }>> {
  const r = await destino(fraccionamientoId, domicilioId)
  if (!r.ok) return r
  let pin: string
  try {
    pin = await generarPin(r.destino.instalacionId, r.destino.titularId)
  } catch (e) {
    return errorDeApi(e)
  }
  await guardarPin(r.destino, domicilioId, pin)

  revalidar(fraccionamientoId, domicilioId)
  return ok({ pin })
}

export async function quitarPinEn(fraccionamientoId: Fraccionamiento, domicilioId: number): Promise<ActionResult> {
  const r = await destino(fraccionamientoId, domicilioId)
  if (!r.ok) return r
  try {
    await quitarPin(r.destino.instalacionId, r.destino.titularId)
  } catch (e) {
    return errorDeApi(e)
  }
  const { error } = await r.destino.supabase.from('pines_acceso').delete().eq('domicilio_id', domicilioId)
  if (error) throw new Error(`No se pudo quitar el PIN: ${error.message}`)

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}
