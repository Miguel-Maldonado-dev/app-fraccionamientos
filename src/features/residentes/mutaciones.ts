import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/supabase/types'
import { MSG_RESIDENTE_NO_ENCONTRADO } from './messages'
import { residenteSchema, type ResidenteInput } from './schemas'

/*
 * Lógica de escritura compartida por las acciones del fraccionamiento (`./actions`) y las de la
 * consola del super admin. No es `'use server'`: no verifica rol y no debe exponerse como acción.
 * `fraccionamientoId` es `null` para el fraccionamiento (RLS limita al suyo) y el id explícito para
 * la consola: entonces filtra por él y lo incluye al insertar.
 */
type Fraccionamiento = number | null

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
  const parsed = residenteSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { nombre, telefono } = parsed.data

  const supabase = await createClient()
  const fila: TablesInsert<'residentes'> = { nombre, telefono: telefono || null, domicilio_id: domicilioId }
  if (fraccionamientoId !== null) fila.fraccionamiento_id = fraccionamientoId
  const { error } = await supabase
    .from('residentes')
    .insert(fila)
  if (error) throw new Error(error.message)

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

export async function actualizarResidenteEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
  input: ResidenteInput,
): Promise<ActionResult> {
  const parsed = residenteSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { nombre, telefono, esPrincipal } = parsed.data

  const supabase = await createClient()
  const query = supabase
    .from('residentes')
    .update({ nombre, telefono: telefono || null, es_principal: esPrincipal ?? false })
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

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}
