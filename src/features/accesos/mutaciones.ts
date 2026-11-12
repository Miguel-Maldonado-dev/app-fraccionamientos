import { fail, ok, type ActionResult } from '@/lib/action-result'
import { LIMITES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/supabase/types'
import { encolar, instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import type { Operacion } from '@/features/sincronizacion/tipos'
import { revalidar } from './revalidar'
import { MSG_ACCESO_NO_ENCONTRADO, MSG_MAX_TARJETAS, MSG_MAX_TELEFONOS } from './messages'
import { descripcionTarjetaSchema, numeroSchema, tarjetaSchema, type TarjetaInput } from './schemas'

/*
 * Lógica de escritura de teléfonos y tarjetas compartida por las acciones del fraccionamiento
 * (`./actions`) y las de la consola del super admin. No es `'use server'`: no verifica rol y no
 * debe exponerse como acción. `fraccionamientoId` es `null` para el fraccionamiento (RLS limita al
 * suyo) y el id explícito para la consola: entonces filtra por él (también al contar contra el
 * límite) y lo incluye al insertar.
 */
type Fraccionamiento = number | null

/** Teléfonos: sin sincronización (access-core aún no los soporta). Las tarjetas tienen sus funciones abajo. */
export type AccesoConfig = {
  table: 'telefonos_acceso'
  column: 'telefono'
  limit: number
  maxMessage: string
}

export const TELEFONO: AccesoConfig = {
  table: 'telefonos_acceso',
  column: 'telefono',
  limit: LIMITES.TELEFONOS,
  maxMessage: MSG_MAX_TELEFONOS,
}

export async function crearAccesoEn(
  config: AccesoConfig,
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
  valor: string,
): Promise<ActionResult> {
  const parsed = numeroSchema.safeParse({ valor })
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const supabase = await createClient()
  let conteo = supabase.from(config.table).select('id', { count: 'exact', head: true }).eq('domicilio_id', domicilioId)
  if (fraccionamientoId !== null) conteo = conteo.eq('fraccionamiento_id', fraccionamientoId)
  const { count, error: countError } = await conteo
  if (countError) throw new Error(countError.message)
  if ((count ?? 0) >= config.limit) return fail(config.maxMessage)

  const fila = { domicilio_id: domicilioId, [config.column]: parsed.data.valor }
  const { error } = await supabase
    .from(config.table)
    .insert((fraccionamientoId === null ? fila : { ...fila, fraccionamiento_id: fraccionamientoId }) as never)
  if (error) throw new Error(error.message)

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

export async function actualizarAccesoEn(
  config: AccesoConfig,
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
  valor: string,
): Promise<ActionResult> {
  const parsed = numeroSchema.safeParse({ valor })
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const supabase = await createClient()
  const query = supabase
    .from(config.table)
    .update({ [config.column]: parsed.data.valor } as never)
    .eq('id', id)
  if (fraccionamientoId === null) {
    const { error } = await query
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await query.eq('fraccionamiento_id', fraccionamientoId).select('id')
    if (error) throw new Error(error.message)
    if ((data ?? []).length === 0) return fail(MSG_ACCESO_NO_ENCONTRADO)
  }

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

export async function eliminarAccesoEn(
  config: AccesoConfig,
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  const supabase = await createClient()
  const query = supabase.from(config.table).delete().eq('id', id)
  if (fraccionamientoId === null) {
    const { error } = await query
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await query.eq('fraccionamiento_id', fraccionamientoId).select('id')
    if (error) throw new Error(error.message)
    if ((data ?? []).length === 0) return fail(MSG_ACCESO_NO_ENCONTRADO)
  }

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Tarjetas: cada escritura encola su tarea de sincronización con access-core si el fraccionamiento
// tiene instalación. `crear` encola después de insertar (la política exige la fila); `actualizar` y
// `borrar` encolan ANTES de escribir, para que un fallo de la escritura no pierda la tarea.

type Supabase = Awaited<ReturnType<typeof createClient>>

async function encolarTarjeta(
  supabase: Supabase,
  fraccionamientoId: Fraccionamiento,
  fila: { id: number; domicilio_id: number },
  operacion: Extract<Operacion, 'crear' | 'actualizar' | 'borrar'>,
  carga?: Record<string, unknown>,
): Promise<number | null> {
  const inst = await instalacionDe(supabase, fraccionamientoId)
  if (!inst) return null
  await encolar(supabase, [
    {
      fraccionamientoId: inst.fid,
      domicilioId: fila.domicilio_id,
      entidad: 'tarjeta',
      entidadId: fila.id,
      operacion,
      ...(carga && { carga }),
    },
  ])
  return inst.fid
}

/** La tarjeta del fraccionamiento (RLS o el `fraccionamientoId` explícito), o `null` si ya no existe. */
async function leerTarjeta(supabase: Supabase, fraccionamientoId: Fraccionamiento, id: number) {
  let q = supabase.from('tarjetas_acceso').select('id, domicilio_id, tarjeta_id').eq('id', id)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function crearTarjetaEn(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
  input: TarjetaInput,
): Promise<ActionResult> {
  const parsed = tarjetaSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const supabase = await createClient()
  let conteo = supabase.from('tarjetas_acceso').select('id', { count: 'exact', head: true }).eq('domicilio_id', domicilioId)
  if (fraccionamientoId !== null) conteo = conteo.eq('fraccionamiento_id', fraccionamientoId)
  const { count, error: countError } = await conteo
  if (countError) throw new Error(countError.message)
  if ((count ?? 0) >= LIMITES.TARJETAS) return fail(MSG_MAX_TARJETAS)

  const fila: TablesInsert<'tarjetas_acceso'> = {
    domicilio_id: domicilioId,
    numero: parsed.data.numero,
    descripcion: parsed.data.descripcion || null,
  }
  if (fraccionamientoId !== null) fila.fraccionamiento_id = fraccionamientoId
  const { data: creada, error } = await supabase
    .from('tarjetas_acceso')
    .insert(fila)
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  let fid: number | null
  try {
    fid = await encolarTarjeta(supabase, fraccionamientoId, { id: creada.id, domicilio_id: domicilioId }, 'crear')
  } catch (e) {
    // Sin tarea, la tarjeta no llegaría a access-core: se deshace para que el usuario pueda reintentar.
    const { error: errBorrar } = await supabase.from('tarjetas_acceso').delete().eq('id', creada.id)
    if (errBorrar) console.error(`No se pudo deshacer la tarjeta ${creada.id}: ${errBorrar.message}`)
    throw e
  }
  if (fid !== null) dispararSincronizacion(fid)

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

/** Solo cambia la descripción: el número no se edita (para cambiarlo se borra y se crea otra). */
export async function actualizarTarjetaEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
  descripcion: string,
): Promise<ActionResult> {
  const parsed = descripcionTarjetaSchema.safeParse(descripcion)
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const supabase = await createClient()
  const actual = await leerTarjeta(supabase, fraccionamientoId, id)
  if (!actual) return fail(MSG_ACCESO_NO_ENCONTRADO)
  const fid = await encolarTarjeta(supabase, fraccionamientoId, actual, 'actualizar')

  let q = supabase.from('tarjetas_acceso').update({ descripcion: parsed.data || null }).eq('id', id)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { error } = await q
  if (error) throw new Error(error.message)

  if (fid !== null) dispararSincronizacion(fid)
  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

export async function eliminarTarjetaEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  const supabase = await createClient()
  const actual = await leerTarjeta(supabase, fraccionamientoId, id)
  if (!actual) return fail(MSG_ACCESO_NO_ENCONTRADO)
  // La política de la cola exige que la fila exista: el `borrar` va antes del delete, con el id externo.
  const fid = await encolarTarjeta(supabase, fraccionamientoId, actual, 'borrar', { tarjeta_id: actual.tarjeta_id })

  let q = supabase.from('tarjetas_acceso').delete().eq('id', id)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { error } = await q
  if (error) throw new Error(error.message)

  if (fid !== null) dispararSincronizacion(fid)
  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}
