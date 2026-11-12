import { fail, ok, type ActionResult } from '@/lib/action-result'
import { LIMITES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/database.types'
import type { TablesInsert } from '@/lib/supabase/types'
import { MSG_ACCESO_NO_ENCONTRADO } from '@/features/accesos/messages'
import { revalidar } from '@/features/accesos/revalidar'
import { encolar, instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import type { Operacion } from '@/features/sincronizacion/tipos'
import { MSG_MAX_CONTROLES } from './messages'
import { controlSchema, type BotonGuardado, type ControlInput } from './schemas'

/*
 * Escritura de controles RF compartida por las acciones del fraccionamiento (`./actions`) y las de la
 * consola. No es `'use server'`: no verifica rol. `fraccionamientoId` es `null` para el
 * fraccionamiento (RLS limita al suyo) y el id explícito para la consola (filtra por él y lo
 * incluye al insertar). Igual que las tarjetas: `crear` encola después de insertar (y deshace el
 * insert si no pudo encolar); `actualizar` y `borrar` encolan ANTES de escribir.
 */
type Fraccionamiento = number | null
type Supabase = Awaited<ReturnType<typeof createClient>>

async function encolarControl(
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
      entidad: 'control',
      entidadId: fila.id,
      operacion,
      ...(carga && { carga }),
    },
  ])
  return inst.fid
}

async function leerControl(supabase: Supabase, fraccionamientoId: Fraccionamiento, id: number) {
  let q = supabase.from('controles_acceso').select('id, domicilio_id, fraccionamiento_id, control_id, botones').eq('id', id)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Convierte los botones capturados al formato guardado; conserva el `boton_id` externo de los que siguen. */
function botonesAGuardar(
  botones: { boton: number; rfCode: string }[],
  actuales: BotonGuardado[] = [],
): BotonGuardado[] {
  const ids = new Map(actuales.map((b) => [b.boton, b.boton_id ?? null]))
  return botones.map((b) => ({ boton: b.boton, rf_code: Number(b.rfCode), boton_id: ids.get(b.boton) ?? null }))
}

async function botonesConfigurados(supabase: Supabase, fraccionamientoId: number): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('fraccionamiento_botones')
    .select('boton')
    .eq('fraccionamiento_id', fraccionamientoId)
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((f) => f.boton))
}

export async function crearControlEn(
  fraccionamientoId: Fraccionamiento,
  domicilioId: number,
  input: ControlInput,
): Promise<ActionResult> {
  const parsed = controlSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const supabase = await createClient()
  let conteo = supabase.from('controles_acceso').select('id', { count: 'exact', head: true }).eq('domicilio_id', domicilioId)
  if (fraccionamientoId !== null) conteo = conteo.eq('fraccionamiento_id', fraccionamientoId)
  const { count, error: countError } = await conteo
  if (countError) throw new Error(countError.message)
  if ((count ?? 0) >= LIMITES.CONTROLES) return fail(MSG_MAX_CONTROLES)

  const fila: TablesInsert<'controles_acceso'> = {
    domicilio_id: domicilioId,
    descripcion: parsed.data.descripcion || null,
    botones: botonesAGuardar(parsed.data.botones) as unknown as Json,
  }
  if (fraccionamientoId !== null) fila.fraccionamiento_id = fraccionamientoId
  const { data: creado, error } = await supabase.from('controles_acceso').insert(fila).select('id').single()
  if (error) throw new Error(error.message)

  let fid: number | null
  try {
    fid = await encolarControl(supabase, fraccionamientoId, { id: creado.id, domicilio_id: domicilioId }, 'crear')
  } catch (e) {
    // Sin tarea, el control no llegaría a access-core: se deshace para que el usuario pueda reintentar.
    const { error: errBorrar } = await supabase.from('controles_acceso').delete().eq('id', creado.id)
    if (errBorrar) console.error(`No se pudo deshacer el control ${creado.id}: ${errBorrar.message}`)
    throw e
  }
  if (fid !== null) dispararSincronizacion(fid)

  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

/** Reemplaza descripción y botones; el trabajador manda el control completo (`PUT`) al procesar. */
export async function actualizarControlEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
  input: ControlInput,
): Promise<ActionResult> {
  const parsed = controlSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const supabase = await createClient()
  const actual = await leerControl(supabase, fraccionamientoId, id)
  if (!actual) return fail(MSG_ACCESO_NO_ENCONTRADO)
  const fid = await encolarControl(supabase, fraccionamientoId, actual, 'actualizar')

  const guardados = (actual.botones ?? []) as unknown as BotonGuardado[]
  const configurados = await botonesConfigurados(supabase, actual.fraccionamiento_id)
  const editados = botonesAGuardar(parsed.data.botones, guardados)
  // Los botones sin salida configurada no se ofrecen al editar: se conservan tal cual (código e id externo).
  const conservados = guardados.filter(
    (b) => !configurados.has(b.boton) && !editados.some((e) => e.boton === b.boton),
  )
  const botones = [...editados, ...conservados].sort((a, b) => a.boton - b.boton)
  let q = supabase
    .from('controles_acceso')
    .update({ descripcion: parsed.data.descripcion || null, botones: botones as unknown as Json })
    .eq('id', id)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { error } = await q
  if (error) throw new Error(error.message)

  if (fid !== null) dispararSincronizacion(fid)
  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}

export async function eliminarControlEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  const supabase = await createClient()
  const actual = await leerControl(supabase, fraccionamientoId, id)
  if (!actual) return fail(MSG_ACCESO_NO_ENCONTRADO)
  // La política de la cola exige que la fila exista: el `borrar` va antes del delete, con el id externo.
  const fid = await encolarControl(supabase, fraccionamientoId, actual, 'borrar', { control_id: actual.control_id })

  let q = supabase.from('controles_acceso').delete().eq('id', id)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { error } = await q
  if (error) throw new Error(error.message)

  if (fid !== null) dispararSincronizacion(fid)
  revalidar(fraccionamientoId, domicilioId)
  return ok(undefined)
}
