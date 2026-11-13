'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES, TIPO_PAGO } from '@/lib/constants'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { encolar, instalacionDe, recalcularPermisos } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import type { CatalogoSimple } from './catalogos'
import { MSG_MAX_APP_INVALIDO, MSG_NO_ENCONTRADO, MSG_NOMBRE_DUPLICADO } from './messages'
import { catalogoSchema, maxResidentesAppSchema, tipoCuotaSchema, type CatalogoInput, type TipoCuotaInput } from './schemas'

type TablaCatalogo = 'conceptos_pago' | 'conceptos_descuento' | 'conceptos_recargo'
type Destino = { tabla: TablaCatalogo; columnaMonto: string; tipoPagoId?: number }

const DESTINOS: Record<CatalogoSimple, Destino> = {
  extras: { tabla: 'conceptos_pago', columnaMonto: 'importe', tipoPagoId: TIPO_PAGO.EXTRA },
  descuentos: { tabla: 'conceptos_descuento', columnaMonto: 'monto_descuento' },
  recargos: { tabla: 'conceptos_recargo', columnaMonto: 'monto_recargo' },
}
const TIPO_CUOTA: Destino = { tabla: 'conceptos_pago', columnaMonto: 'importe', tipoPagoId: TIPO_PAGO.RECURRENTE }

const ADMIN = [ROLES.ADMINISTRADOR]

/*
 * Las tres tablas comparten forma (nombre + monto) pero el cliente tipado no admite un nombre de
 * tabla variable; se usa sin tipos de esquema y las columnas quedan cubiertas por las pruebas.
 */
async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient
}

const normalizar = (s: string) => s.trim().toLocaleLowerCase('es')

/**
 * `fraccionamientoId` es `null` para el administrador (RLS ya limita a su fraccionamiento) y el id
 * explícito para la consola del super admin, cuyo `fraccionamiento_actual()` es nulo.
 */
type Fraccionamiento = number | null

function revalidarCatalogos(fraccionamientoId: Fraccionamiento) {
  revalidatePath('/configuracion')
  revalidatePath('/domicilios', 'layout')
  revalidatePath('/cuotas')
  revalidatePath('/pagos')
  if (fraccionamientoId !== null) revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}`)
}

/** Agrega `fraccionamiento_id` a una fila solo cuando se escribe desde la consola. */
const conFraccionamiento = <T extends object>(fila: T, fraccionamientoId: Fraccionamiento) =>
  fraccionamientoId === null ? fila : { ...fila, fraccionamiento_id: fraccionamientoId }

/*
 * Los catálogos tienen pocas filas: se comparan en código para no depender de los comodines de
 * `ilike` (PostgREST también trata `*` como comodín) y para ignorar espacios guardados de más.
 */
async function nombreRepetido(
  supabase: SupabaseClient,
  d: Destino,
  nombre: string,
  id: number | null,
  fraccionamientoId: Fraccionamiento,
) {
  let q = supabase.from(d.tabla).select('id, nombre')
  if (d.tipoPagoId !== undefined) q = q.eq('tipo_pago_id', d.tipoPagoId)
  // El super admin ve todos los fraccionamientos: el nombre solo se compara dentro del indicado.
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const buscado = normalizar(nombre)
  return ((data ?? []) as { id: number; nombre: string }[]).some(
    (r) => r.id !== id && normalizar(r.nombre) === buscado,
  )
}

/** Inserta o actualiza nombre e importe. Devuelve el id, o `null` si el registro a editar ya no existe. */
async function escribir(
  supabase: SupabaseClient,
  d: Destino,
  id: number | null,
  nombre: string,
  importe: number,
  fraccionamientoId: Fraccionamiento,
): Promise<number | null> {
  const valores = { nombre, [d.columnaMonto]: importe }
  if (id === null) {
    const fila = d.tipoPagoId === undefined ? valores : { ...valores, tipo_pago_id: d.tipoPagoId }
    const { data, error } = await supabase
      .from(d.tabla)
      .insert(conFraccionamiento(fila, fraccionamientoId))
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return (data as { id: number } | null)?.id ?? null
  }
  let q = supabase.from(d.tabla).update(valores).eq('id', id)
  if (d.tipoPagoId !== undefined) q = q.eq('tipo_pago_id', d.tipoPagoId)
  if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0 ? id : null
}

async function guardarCatalogoEn(
  fraccionamientoId: Fraccionamiento,
  catalogo: CatalogoSimple,
  id: number | null,
  input: CatalogoInput,
): Promise<ActionResult> {
  const parsed = catalogoSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { nombre, importe } = parsed.data
  const destino = DESTINOS[catalogo]

  const supabase = await db()
  if (await nombreRepetido(supabase, destino, nombre, id, fraccionamientoId)) return fail(MSG_NOMBRE_DUPLICADO)
  const guardado = await escribir(supabase, destino, id, nombre, importe, fraccionamientoId)
  if (id !== null && guardado === null) return fail(MSG_NO_ENCONTRADO)

  revalidarCatalogos(fraccionamientoId)
  return ok(undefined)
}

const mismosMedios = (a: string[], b: string[]) => a.length === b.length && a.every((m) => b.includes(m))

async function guardarTipoCuotaEn(
  fraccionamientoId: Fraccionamiento,
  id: number | null,
  input: TipoCuotaInput,
): Promise<ActionResult> {
  const parsed = tipoCuotaSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const { nombre, importe, medios, perfilCorrienteId, perfilCorrienteNombre, perfilMorosoId, perfilMorosoNombre } =
    parsed.data
  // Sin id de permiso no se guarda su nombre.
  const accesos = {
    medios,
    perfil_corriente_id: perfilCorrienteId,
    perfil_corriente_nombre: perfilCorrienteId ? perfilCorrienteNombre : null,
    perfil_moroso_id: perfilMorosoId,
    perfil_moroso_nombre: perfilMorosoId ? perfilMorosoNombre : null,
  }

  const supabase = await db()
  if (await nombreRepetido(supabase, TIPO_CUOTA, nombre, id, fraccionamientoId)) return fail(MSG_NOMBRE_DUPLICADO)

  /*
   * Qué cambió se decide leyendo la fila actual ANTES de escribir, y las tareas se encolan antes de
   * guardar: si la escritura falla, el reintento del usuario vuelve a ver el cambio y las tareas
   * (idempotentes) ya están en la cola. Un tipo nuevo no tiene domicilios, no hay nada que encolar.
   */
  let inst: Awaited<ReturnType<typeof instalacionDe>> = null
  if (id !== null) {
    inst = await instalacionDe(supabase as never, fraccionamientoId)
    if (inst) {
      let lectura = supabase.from('concepto_pago_acceso').select('medios').eq('concepto_pago_id', id)
      if (fraccionamientoId !== null) lectura = lectura.eq('fraccionamiento_id', fraccionamientoId)
      const { data: actual, error: lecturaError } = await lectura.maybeSingle()
      if (lecturaError) throw new Error(lecturaError.message)
      const antes = ((actual as { medios: string[] } | null)?.medios ?? []) as string[]
      if (!mismosMedios(antes, medios)) {
        const { data, error } = await supabase.from('domicilio_concepto').select('domicilio_id').eq('concepto_id', id)
        if (error) throw new Error(error.message)
        const fid = inst.fid
        await encolar(
          supabase as never,
          ((data ?? []) as { domicilio_id: number }[]).map((r) => ({
            fraccionamientoId: fid,
            domicilioId: r.domicilio_id,
            entidad: 'domicilio' as const,
            entidadId: null,
            operacion: 'reconciliar' as const,
          })),
        )
      }
    }
  }

  const conceptoId = await escribir(supabase, TIPO_CUOTA, id, nombre, importe, fraccionamientoId)
  if (conceptoId === null) return fail(MSG_NO_ENCONTRADO)

  if (id === null) {
    // Sin transacción entre tablas (no hay función SQL): si falla la fila de accesos se deshace el concepto.
    const { error } = await supabase
      .from('concepto_pago_acceso')
      .insert(conFraccionamiento({ concepto_pago_id: conceptoId, ...accesos }, fraccionamientoId))
    if (error) {
      await supabase.from('conceptos_pago').delete().eq('id', conceptoId)
      throw new Error(error.message)
    }
  } else {
    // Se actualiza por concepto y solo se inserta si no había fila, para no crear duplicados al
    // buscar y luego insertar.
    let q = supabase.from('concepto_pago_acceso').update(accesos).eq('concepto_pago_id', id)
    if (fraccionamientoId !== null) q = q.eq('fraccionamiento_id', fraccionamientoId)
    const { data: actualizadas, error } = await q.select('id')
    const { error: insertError } =
      !error && (actualizadas ?? []).length === 0
        ? await supabase
            .from('concepto_pago_acceso')
            .insert(conFraccionamiento({ concepto_pago_id: id, ...accesos }, fraccionamientoId))
        : { error: null }
    const fallo = error ?? insertError
    if (fallo) {
      // Nombre e importe ya quedaron guardados: se refrescan las pantallas antes de reportar el error.
      revalidarCatalogos(fraccionamientoId)
      throw new Error(fallo.message)
    }
  }

  /*
   * `recalcular_permisos_acceso` es idempotente (solo encola donde el permiso deseado difiere del
   * asignado y no hay un `asignar` pendiente): se llama en cada guardado de un tipo existente, así
   * un reintento tras un fallo posterior a la escritura no pierde el cambio de permiso.
   */
  if (inst) {
    await recalcularPermisos(supabase as never, inst.fid)
    dispararSincronizacion(inst.fid)
  }

  revalidarCatalogos(fraccionamientoId)
  return ok(undefined)
}

export async function guardarCatalogo(
  catalogo: CatalogoSimple,
  id: number | null,
  input: CatalogoInput,
): Promise<ActionResult> {
  return runAction(ADMIN, () => guardarCatalogoEn(null, catalogo, id, input))
}

export async function guardarTipoCuota(id: number | null, input: TipoCuotaInput): Promise<ActionResult> {
  return runAction(ADMIN, () => guardarTipoCuotaEn(null, id, input))
}

/** Máximo de residentes con acceso a la app por domicilio. Solo administrador; RLS limita al suyo. */
export async function guardarMaxResidentesApp(valor: number): Promise<ActionResult> {
  return runAction(ADMIN, async () => {
    const parsed = maxResidentesAppSchema.safeParse(valor)
    if (!parsed.success) return fail(MSG_MAX_APP_INVALIDO)
    const fid = (await getTenantContext())?.fraccionamiento?.id
    if (fid == null) return fail(MSG_NO_ENCONTRADO)
    const supabase = await createClient()
    const { error } = await supabase
      .from('fraccionamientos')
      .update({ max_residentes_app: parsed.data })
      .eq('id', fid)
    if (error) throw new Error(error.message)
    revalidatePath('/configuracion')
    revalidatePath('/domicilios', 'layout')
    return ok(undefined)
  })
}
