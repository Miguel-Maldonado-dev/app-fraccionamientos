import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/supabase/types'
import { encolar, instalacionDe } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import type { TareaNueva } from '@/features/sincronizacion/tipos'
import { MSG_DOMICILIO_DUPLICADO, MSG_DOMICILIO_NO_ENCONTRADO } from './messages'
import { getDomicilioConcepto } from './queries'
import { domicilioSchema, type DomicilioInput } from './schemas'

/*
 * Lógica de escritura compartida por las acciones del fraccionamiento (`./actions`) y las de la
 * consola del super admin. No es un archivo `'use server'`: estas funciones no verifican rol y no
 * deben quedar expuestas como Server Actions; cada acción las envuelve con su verificación.
 *
 * `fraccionamientoId` es `null` para el fraccionamiento (RLS ya limita al suyo) y el id explícito
 * para la consola, cuyo `fraccionamiento_actual()` es nulo: entonces se filtra por él y se incluye
 * al insertar.
 */
type Fraccionamiento = number | null

/** Datos del titular `domicilio` en access-core: el trabajador los manda tal cual en crear y actualizar. */
function cargaTitular(direccion: string, observaciones: string | null) {
  return { kind: 'domicilio', name: direccion, address: direccion, notes: observaciones ?? '' }
}

function revalidar(fraccionamientoId: Fraccionamiento, domicilioId?: number) {
  if (fraccionamientoId === null) {
    revalidatePath('/domicilios')
    if (domicilioId !== undefined) revalidatePath(`/domicilios/${domicilioId}`)
    return
  }
  revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}`)
  if (domicilioId !== undefined) revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}/domicilios/${domicilioId}`)
}

export async function crearDomicilioEn(
  fraccionamientoId: Fraccionamiento,
  createdBy: string,
  input: DomicilioInput,
): Promise<ActionResult<{ id: number }>> {
  const parsed = domicilioSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { direccion, fechaAlta, conceptoId, observaciones } = parsed.data

  const supabase = await createClient()
  // `domicilios_info` no expone `fraccionamiento_id`: la consola busca el duplicado en la tabla.
  const { data: existentes, error: dupError } =
    fraccionamientoId === null
      ? await supabase.from('domicilios_info').select('id').eq('direccion', direccion).limit(1)
      : await supabase
          .from('domicilios')
          .select('id')
          .eq('direccion', direccion)
          .eq('fraccionamiento_id', fraccionamientoId)
          .limit(1)
  if (dupError) throw new Error(dupError.message)
  if (existentes && existentes.length > 0) return fail(MSG_DOMICILIO_DUPLICADO)

  const fila: TablesInsert<'domicilios'> = {
    direccion,
    fecha_alta: fechaAlta,
    observaciones: observaciones || null,
    created_by: createdBy,
  }
  if (fraccionamientoId !== null) fila.fraccionamiento_id = fraccionamientoId
  const { data: creado, error } = await supabase
    .from('domicilios')
    .insert(fila)
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (conceptoId !== undefined) {
    const concepto: TablesInsert<'domicilio_concepto'> = { domicilio_id: creado.id, concepto_id: conceptoId }
    if (fraccionamientoId !== null) concepto.fraccionamiento_id = fraccionamientoId
    const { error: conceptoError } = await supabase
      .from('domicilio_concepto')
      .insert(concepto)
    if (conceptoError) throw new Error(conceptoError.message)
  }

  // El domicilio debe existir antes de encolar (la política valida la fila). Si encolar falla, el
  // domicilio queda sin tareas: volver a guardar la instalación en la consola lo encola (es repetible).
  const inst = await instalacionDe(supabase, fraccionamientoId)
  if (inst) {
    const base = { fraccionamientoId: inst.fid, domicilioId: creado.id, entidad: 'domicilio' } as const
    await encolar(supabase, [
      {
        ...base,
        entidadId: creado.id,
        operacion: 'crear',
        carga: cargaTitular(direccion, observaciones || null),
      },
      { ...base, entidadId: null, operacion: 'asignar' },
    ])
    dispararSincronizacion(inst.fid)
  }

  revalidar(fraccionamientoId)
  return ok({ id: creado.id })
}

/**
 * Con `conceptoId` presente el fraccionamiento también asigna el tipo de cuota. La consola nunca lo
 * cambia (el super admin no puede actualizar `domicilio_concepto`): con un id se ignora.
 */
export async function actualizarDomicilioEn(
  fraccionamientoId: Fraccionamiento,
  id: number,
  input: DomicilioInput,
): Promise<ActionResult> {
  const parsed = domicilioSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { direccion, fechaAlta, conceptoId, observaciones } = parsed.data

  const supabase = await createClient()
  let lectura = supabase.from('domicilios').select('direccion, observaciones').eq('id', id)
  if (fraccionamientoId !== null) lectura = lectura.eq('fraccionamiento_id', fraccionamientoId)
  const { data: actual, error: errActual } = await lectura.maybeSingle()
  if (errActual) throw new Error(errActual.message)
  if (!actual) return fail(MSG_DOMICILIO_NO_ENCONTRADO)

  // La consola nunca cambia el tipo de cuota.
  const cambiaTipo = fraccionamientoId === null && conceptoId !== undefined
  const existente = cambiaTipo ? await getDomicilioConcepto(supabase, id) : null
  const tipoCambio = cambiaTipo && existente?.concepto_id !== conceptoId
  const notas = observaciones || null
  const datosCambio = actual.direccion !== direccion || (actual.observaciones ?? null) !== notas

  // Se encola ANTES de escribir: si la escritura falla, un reintento ya no vería el cambio, pero la
  // tarea ya está en la cola (el trabajador lee los datos al procesar).
  let fidSync: number | null = null
  if (datosCambio || tipoCambio) {
    const inst = await instalacionDe(supabase, fraccionamientoId)
    if (inst) {
      const base = { fraccionamientoId: inst.fid, domicilioId: id, entidad: 'domicilio' } as const
      const tareas: TareaNueva[] = []
      if (datosCambio) {
        tareas.push({ ...base, entidadId: id, operacion: 'actualizar', carga: cargaTitular(direccion, notas) })
      }
      if (tipoCambio) {
        tareas.push({ ...base, entidadId: null, operacion: 'reconciliar' }, { ...base, entidadId: null, operacion: 'asignar' })
      }
      await encolar(supabase, tareas)
      fidSync = inst.fid
    }
  }

  const datos = { direccion, fecha_alta: fechaAlta, observaciones: notas }
  if (fraccionamientoId === null) {
    const { error } = await supabase.from('domicilios').update(datos).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await supabase
      .from('domicilios')
      .update(datos)
      .eq('id', id)
      .eq('fraccionamiento_id', fraccionamientoId)
      .select('id')
    if (error) throw new Error(error.message)
    if ((data ?? []).length === 0) return fail(MSG_DOMICILIO_NO_ENCONTRADO)
  }

  if (tipoCambio) {
    const { error: conceptoError } = existente
      ? await supabase.from('domicilio_concepto').update({ concepto_id: conceptoId }).eq('id', existente.id)
      : await supabase.from('domicilio_concepto').insert({ domicilio_id: id, concepto_id: conceptoId })
    if (conceptoError) throw new Error(conceptoError.message)
  }

  if (fidSync !== null) dispararSincronizacion(fidSync)
  revalidar(fraccionamientoId, id)
  return ok(undefined)
}
