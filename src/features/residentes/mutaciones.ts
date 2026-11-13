import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/supabase/types'
import { prepararEliminacionConAcceso } from './acceso-app'
import { MSG_RESIDENTE_NO_ENCONTRADO, MSG_TELEFONO_CON_ACCESO_APP } from './messages'
import { residenteSchema, type ResidenteInput } from './schemas'
import { normalizarTelefono } from './telefono'

/*
 * Lógica de escritura compartida por las acciones del fraccionamiento (`./actions`) y las de la
 * consola del super admin. No es `'use server'`: no verifica rol y no debe exponerse como acción.
 * `fraccionamientoId` es `null` para el fraccionamiento (RLS limita al suyo) y el id explícito para
 * la consola: entonces filtra por él y lo incluye al insertar.
 */
type Fraccionamiento = number | null

/** El residente visible con el cliente del usuario (RLS), filtrado por fraccionamiento si se da. */
async function residenteActual(fraccionamientoId: Fraccionamiento, id: number) {
  const supabase = await createClient()
  let query = supabase.from('residentes').select('id, telefono, user_id').eq('id', id)
  if (fraccionamientoId !== null) query = query.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function revalidar(fraccionamientoId: Fraccionamiento, domicilioId: number) {
  if (fraccionamientoId === null) {
    revalidatePath(`/domicilios/${domicilioId}`)
    revalidatePath('/residentes')
    return
  }
  revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}`)
  revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}/domicilios/${domicilioId}`)
}

export async function crearResidenteEn(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
  input: ResidenteInput,
): Promise<ActionResult> {
  const r = await insertarResidente(fraccionamientoId, domicilioId, input, false)
  return r.ok ? ok(undefined) : r
}

/** Como `crearResidenteEn`, pero devuelve el id del residente creado. */
export async function crearResidenteConIdEn(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
  input: ResidenteInput,
): Promise<ActionResult<number>> {
  return insertarResidente(fraccionamientoId, domicilioId, input, true)
}

async function insertarResidente(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
  input: ResidenteInput,
  conId: boolean,
): Promise<ActionResult<number>> {
  const parsed = residenteSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { nombre, telefono } = parsed.data

  const supabase = await createClient()
  const fila: TablesInsert<'residentes'> = { nombre, telefono: telefono || null, domicilio_id: domicilioId }
  if (fraccionamientoId !== null) fila.fraccionamiento_id = fraccionamientoId
  let id = 0
  if (conId) {
    const { data, error } = await supabase.from('residentes').insert(fila).select('id').single()
    if (error) throw new Error(error.message)
    id = data.id
  } else {
    const { error } = await supabase.from('residentes').insert(fila)
    if (error) throw new Error(error.message)
  }

  revalidar(fraccionamientoId, domicilioId)
  return ok(id)
}

export async function actualizarResidenteEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
  input: ResidenteInput,
): Promise<ActionResult> {
  const parsed = residenteSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { nombre, esPrincipal } = parsed.data
  // Si no se puede normalizar (residente sin cuenta) se guarda como se escribió.
  const telefono = parsed.data.telefono ? (normalizarTelefono(parsed.data.telefono) ?? parsed.data.telefono) : null

  const actual = await residenteActual(fraccionamientoId, id)
  if (actual?.user_id) {
    const anterior = actual.telefono ? (normalizarTelefono(actual.telefono) ?? actual.telefono) : null
    if (telefono !== anterior) return fail(MSG_TELEFONO_CON_ACCESO_APP)
  }

  const supabase = await createClient()
  const query = supabase
    .from('residentes')
    .update({ nombre, telefono, es_principal: esPrincipal ?? false })
    .eq('id', id)
  if (fraccionamientoId === null) {
    const { error } = await query
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await query.eq('fraccionamiento_id', fraccionamientoId).select('id')
    if (error) throw new Error(error.message)
    if ((data ?? []).length === 0) return fail(MSG_RESIDENTE_NO_ENCONTRADO)
  }

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

export async function eliminarResidenteEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  const actual = await residenteActual(fraccionamientoId, id)
  if (!actual) return fail(MSG_RESIDENTE_NO_ENCONTRADO)
  // Con acceso a la app: misma limpieza que al quitar el acceso (service-role tras validar con RLS).
  const despues = actual.user_id ? await prepararEliminacionConAcceso(id, actual.user_id) : null

  const supabase = await createClient()
  const query = supabase.from('residentes').delete().eq('id', id)
  if (fraccionamientoId === null) {
    const { error } = await query
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await query.eq('fraccionamiento_id', fraccionamientoId).select('id')
    if (error) throw new Error(error.message)
    if ((data ?? []).length === 0) return fail(MSG_RESIDENTE_NO_ENCONTRADO)
  }
  if (despues) await despues()

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}
