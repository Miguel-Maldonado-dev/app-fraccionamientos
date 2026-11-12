'use server'

import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runSuperAdminAction } from '@/lib/auth/run-action'
import { encolar } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import type { TareaNueva } from '@/features/sincronizacion/tipos'
import { createClient } from '@/lib/supabase/server'
import {
  MSG_FRACCIONAMIENTO_NO_EXISTE,
  MSG_INSTALACION_DUPLICADA,
  MSG_INSTALACION_EN_USO,
  MSG_SINCRONIZACION_EN_CURSO,
  MSG_SLUG_DUPLICADO,
} from './messages'
import { fraccionamientoSchema, type FraccionamientoDatos, type FraccionamientoInput } from './schemas'

type ErrorBase = { code?: string; message?: string; details?: string | null }

const aFila = (d: FraccionamientoDatos) => ({
  nombre: d.nombre,
  slug: d.slug,
  instalacion_id: d.instalacionId,
  // El nombre es copia de la API para mostrar: sin instalación no hay nombre que guardar.
  instalacion_nombre: d.instalacionId ? d.instalacionNombre : null,
  activo: d.activo,
})

/** Restricciones únicas de `fraccionamientos` y el mensaje para cada una. */
const DUPLICADOS: Record<string, string> = {
  fraccionamientos_slug_key: MSG_SLUG_DUPLICADO,
  fraccionamientos_instalacion_id_key: MSG_INSTALACION_DUPLICADA,
}

/**
 * Traduce una violación de unicidad (23505) a un mensaje para el usuario. Se compara el nombre de
 * la restricción que PostgREST pone en `message`; `details` no se usa porque incluye el valor
 * duplicado (un slug como `instalacion-norte` confundiría la búsqueda). Cualquier otro error se
 * lanza para que `runSuperAdminAction` responda con el mensaje genérico.
 */
function mensajeDuplicado(error: ErrorBase): string {
  if (error.code === '23505') {
    const restriccion = /unique constraint "([^"]+)"/.exec(error.message ?? '')?.[1]
    const mensaje = restriccion ? DUPLICADOS[restriccion] : undefined
    if (mensaje) return mensaje
  }
  throw new Error(error.message ?? 'Error de base de datos')
}

export async function crearFraccionamiento(input: FraccionamientoInput): Promise<ActionResult<{ id: number }>> {
  return runSuperAdminAction(async () => {
    const parsed = fraccionamientoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0].message)

    const supabase = await createClient()
    const { data, error } = await supabase.from('fraccionamientos').insert(aFila(parsed.data)).select('id').single()
    if (error) return fail(mensajeDuplicado(error))

    revalidatePath('/admin')
    revalidatePath('/admin/fraccionamientos')
    return ok({ id: data.id })
  })
}

/**
 * Encola crear, reconciliar y asignar, en ese orden, para cada domicilio que aún no tiene titular y
 * no tiene una tarea `domicilio crear` sin terminar. Es repetible: tras un fallo, guardar de nuevo
 * encola lo que falte; con todo encolado no hace nada.
 */
async function encolarVinculacion(supabase: Awaited<ReturnType<typeof createClient>>, fraccionamientoId: number) {
  const { data, error } = await supabase
    .from('domicilios')
    .select('id, direccion, observaciones')
    .eq('fraccionamiento_id', fraccionamientoId)
    .is('titular_id', null)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  const candidatos = data ?? []
  if (candidatos.length === 0) return

  const { data: sinTerminar, error: errTareas } = await supabase
    .from('sincronizaciones_acceso')
    .select('domicilio_id')
    .eq('fraccionamiento_id', fraccionamientoId)
    .eq('entidad', 'domicilio')
    .eq('operacion', 'crear')
    .in('estado', ['pendiente', 'error'])
  if (errTareas) throw new Error(errTareas.message)
  const yaEncolados = new Set((sinTerminar ?? []).map((t) => t.domicilio_id))

  const tareas: TareaNueva[] = candidatos
    .filter((d) => !yaEncolados.has(d.id))
    .flatMap((d) => {
      const base = { fraccionamientoId, domicilioId: d.id, entidad: 'domicilio', entidadId: null } as const
      return [
        {
          ...base,
          entidadId: d.id,
          operacion: 'crear',
          carga: { kind: 'domicilio', name: d.direccion, address: d.direccion, notes: d.observaciones ?? '' },
        },
        { ...base, operacion: 'reconciliar' },
        { ...base, operacion: 'asignar' },
      ] satisfies TareaNueva[]
    })
  if (tareas.length === 0) return
  await encolar(supabase, tareas)
  dispararSincronizacion(fraccionamientoId)
}

export async function actualizarFraccionamiento(id: number, input: FraccionamientoInput): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    const parsed = fraccionamientoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0].message)

    const supabase = await createClient()
    const { data: actual, error: errActual } = await supabase
      .from('fraccionamientos')
      .select('instalacion_id')
      .eq('id', id)
      .maybeSingle()
    if (errActual) throw new Error(errActual.message)
    if (!actual) return fail(MSG_FRACCIONAMIENTO_NO_EXISTE)

    const anterior = actual.instalacion_id
    const nueva = parsed.data.instalacionId
    const cambia = anterior !== nueva

    // Con titulares ya creados en la instalación actual, cambiarla o quitarla dejaría datos huérfanos.
    if (cambia && anterior) {
      const { count, error: errTitulares } = await supabase
        .from('domicilios')
        .select('id', { count: 'exact', head: true })
        .eq('fraccionamiento_id', id)
        .not('titular_id', 'is', null)
      if (errTitulares) throw new Error(errTitulares.message)
      if ((count ?? 0) > 0) return fail(MSG_INSTALACION_EN_USO)
    }

    // Las tareas sin terminar eran de la instalación anterior. Se cancelan ANTES de guardar (es idempotente):
    // si fallara después de guardar, el reintento ya no vería cambio y las tareas viejas seguirían bloqueando.
    if (cambia) {
      const { error: errCancelar } = await supabase.rpc('cancelar_sincronizaciones', { p_fraccionamiento_id: id })
      // Un trabajador tiene el lease: cancelar ahora dejaría que guardara ids de la instalación anterior.
      if (errCancelar?.code === 'P0001' && errCancelar.message.includes('sincronización en curso')) {
        return fail(MSG_SINCRONIZACION_EN_CURSO)
      }
      if (errCancelar) throw new Error(errCancelar.message)
    }

    const { data, error } = await supabase
      .from('fraccionamientos')
      .update(aFila(parsed.data))
      .eq('id', id)
      .select('id')
    if (error) return fail(mensajeDuplicado(error))
    if ((data ?? []).length === 0) return fail(MSG_FRACCIONAMIENTO_NO_EXISTE)

    if (nueva) await encolarVinculacion(supabase, id)

    revalidatePath('/admin')
    revalidatePath('/admin/fraccionamientos')
    revalidatePath(`/admin/fraccionamientos/${id}`)
    return ok(undefined)
  })
}
