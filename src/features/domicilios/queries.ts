import type { SupabaseClient } from '@supabase/supabase-js'
import { TIPO_PAGO, type MedioAcceso } from '@/lib/constants'
import type { Database } from '@/lib/supabase/database.types'
import type { Tables, Views } from '@/lib/supabase/types'

export type DomicilioInfo = Views<'domicilios_info'>

export async function listDomicilios(supabase: SupabaseClient<Database>): Promise<DomicilioInfo[]> {
  const { data, error } = await supabase.from('domicilios_info').select('*').order('direccion', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los domicilios: ${error.message}`)
  return data ?? []
}

export async function getDomicilioInfo(
  supabase: SupabaseClient<Database>,
  id: number,
): Promise<DomicilioInfo | null> {
  const { data, error } = await supabase.from('domicilios_info').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`No se pudo leer el domicilio: ${error.message}`)
  return data
}

export async function listConceptosRecurrentes(
  supabase: SupabaseClient<Database>,
): Promise<Tables<'conceptos_pago'>[]> {
  const query = supabase.from('conceptos_pago').select('*').eq('tipo_pago_id', TIPO_PAGO.RECURRENTE)
  const { data, error } = await query.order('nombre', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los conceptos: ${error.message}`)
  return data ?? []
}

export async function listDomiciliosOptions(
  supabase: SupabaseClient<Database>,
): Promise<{ id: number; direccion: string }[]> {
  const { data, error } = await supabase.from('domicilios').select('id, direccion').order('direccion', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los domicilios: ${error.message}`)
  return data ?? []
}

export async function getDomicilioConcepto(
  supabase: SupabaseClient<Database>,
  domicilioId: number,
): Promise<Tables<'domicilio_concepto'> | null> {
  const { data, error } = await supabase
    .from('domicilio_concepto')
    .select('*')
    .eq('domicilio_id', domicilioId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer el concepto del domicilio: ${error.message}`)
  return data
}

/*
 * Lecturas de la consola del super admin. No usan `domicilios_info`, cuyo `estatus` depende de
 * `cuotas` (el super admin no tiene acceso a dinero): arman la misma forma sin estatus.
 */

/** Tipos de cuota recurrentes de un fraccionamiento para el selector de la consola: sin importes. */
export async function listTiposCuotaConsola(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number,
): Promise<{ id: number; nombre: string }[]> {
  const { data, error } = await supabase
    .from('conceptos_pago')
    .select('id, nombre')
    .eq('fraccionamiento_id', fraccionamientoId)
    .eq('tipo_pago_id', TIPO_PAGO.RECURRENTE)
    .order('nombre', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los conceptos: ${error.message}`)
  return data ?? []
}

/** Domicilios de un fraccionamiento, con el residente principal y sin estatus de pago. */
export async function listDomiciliosConsola(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number,
): Promise<DomicilioInfo[]> {
  const [doms, resis, dcs, tipos] = await Promise.all([
    supabase
      .from('domicilios')
      .select('id, direccion, fecha_alta, observaciones')
      .eq('fraccionamiento_id', fraccionamientoId)
      .order('direccion', { ascending: true }),
    supabase
      .from('residentes')
      .select('domicilio_id, nombre')
      .eq('fraccionamiento_id', fraccionamientoId)
      .eq('es_principal', true),
    supabase.from('domicilio_concepto').select('domicilio_id, concepto_id').eq('fraccionamiento_id', fraccionamientoId),
    supabase.from('conceptos_pago').select('id, nombre').eq('fraccionamiento_id', fraccionamientoId),
  ])
  if (doms.error) throw new Error(`No se pudieron leer los domicilios: ${doms.error.message}`)
  if (resis.error) throw new Error(`No se pudieron leer los residentes: ${resis.error.message}`)
  if (dcs.error) throw new Error(`No se pudieron leer los conceptos de los domicilios: ${dcs.error.message}`)
  if (tipos.error) throw new Error(`No se pudieron leer los conceptos: ${tipos.error.message}`)
  const nombreConcepto = new Map((tipos.data ?? []).map((t) => [t.id, t.nombre]))
  const conceptoDe = new Map((dcs.data ?? []).map((x) => [x.domicilio_id, x.concepto_id]))
  const principal = new Map<number, string>()
  for (const r of resis.data ?? []) if (!principal.has(r.domicilio_id)) principal.set(r.domicilio_id, r.nombre)
  return (doms.data ?? []).map((d) => ({
    id: d.id,
    direccion: d.direccion,
    fecha_alta: d.fecha_alta,
    observaciones: d.observaciones,
    residente_principal: principal.get(d.id) ?? 'Sin información',
    id_concepto: conceptoDe.get(d.id) ?? null,
    tipo_cuota: nombreConcepto.get(conceptoDe.get(d.id) ?? -1) ?? null,
    medios: null,
    estatus: null,
  }))
}

export type DomicilioConsola = DomicilioInfo & { fraccionamientoId: number }

/** Un domicilio con su tipo de cuota y accesos; trae su `fraccionamientoId` para que la página lo compare con la URL. */
export async function getDomicilioConsola(
  supabase: SupabaseClient<Database>,
  id: number,
): Promise<DomicilioConsola | null> {
  const { data: d, error } = await supabase
    .from('domicilios')
    .select('id, direccion, fecha_alta, observaciones, fraccionamiento_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer el domicilio: ${error.message}`)
  if (!d) return null
  const fid = d.fraccionamiento_id

  const [principal, dc] = await Promise.all([
    supabase
      .from('residentes')
      .select('nombre')
      .eq('fraccionamiento_id', fid)
      .eq('domicilio_id', id)
      .eq('es_principal', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('domicilio_concepto')
      .select('concepto_id')
      .eq('fraccionamiento_id', fid)
      .eq('domicilio_id', id)
      .maybeSingle(),
  ])
  if (principal.error) throw new Error(`No se pudo leer el residente principal: ${principal.error.message}`)
  if (dc.error) throw new Error(`No se pudo leer el concepto del domicilio: ${dc.error.message}`)

  const conceptoId = dc.data?.concepto_id ?? null
  let tipoCuota: string | null = null
  // Igual que `domicilios_info`: sin concepto (o sin fila de accesos) no hay medios.
  let medios: MedioAcceso[] = []
  if (conceptoId !== null) {
    const [cp, acc] = await Promise.all([
      supabase.from('conceptos_pago').select('nombre').eq('fraccionamiento_id', fid).eq('id', conceptoId).maybeSingle(),
      supabase
        .from('concepto_pago_acceso')
        .select('medios')
        .eq('fraccionamiento_id', fid)
        .eq('concepto_pago_id', conceptoId)
        .maybeSingle(),
    ])
    if (cp.error) throw new Error(`No se pudo leer el tipo de cuota: ${cp.error.message}`)
    if (acc.error) throw new Error(`No se pudo leer el acceso del concepto: ${acc.error.message}`)
    tipoCuota = cp.data?.nombre ?? null
    medios = acc.data?.medios ?? []
  }

  return {
    id: d.id,
    direccion: d.direccion,
    fecha_alta: d.fecha_alta,
    observaciones: d.observaciones,
    residente_principal: principal.data?.nombre ?? 'Sin información',
    id_concepto: conceptoId,
    tipo_cuota: tipoCuota,
    medios,
    estatus: null,
    fraccionamientoId: fid,
  }
}

/** Permiso de acceso del domicilio en access-core: el nombre del perfil asignado y si difiere del deseado. */
export type PermisoDomicilio = { nombre: string | null; pendiente: boolean }

/**
 * `null` si el fraccionamiento no tiene instalación de access-core. El nombre sale de los perfiles del
 * tipo de cuota (`perfil_corriente_*` / `perfil_moroso_*`) que coinciden con `perfil_asignado_id`.
 * Solo para el fraccionamiento: el nombre del permiso (y `perfil_deseado`) revela el estado de pago,
 * así que la consola del super admin nunca lo muestra.
 */
export async function getPermisoDomicilio(
  supabase: SupabaseClient<Database>,
  domicilioId: number,
): Promise<PermisoDomicilio | null> {
  const { data: dom, error } = await supabase
    .from('domicilios')
    .select('perfil_asignado_id, fraccionamiento_id')
    .eq('id', domicilioId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer el domicilio: ${error.message}`)
  if (!dom) return null

  const [fracc, dc] = await Promise.all([
    supabase.from('fraccionamientos').select('instalacion_id').eq('id', dom.fraccionamiento_id).maybeSingle(),
    supabase.from('domicilio_concepto').select('concepto_id').eq('domicilio_id', domicilioId).maybeSingle(),
  ])
  if (fracc.error) throw new Error(`No se pudo leer el fraccionamiento: ${fracc.error.message}`)
  if (!fracc.data?.instalacion_id) return null
  if (dc.error) throw new Error(`No se pudo leer el concepto del domicilio: ${dc.error.message}`)

  const asignado = dom.perfil_asignado_id
  let nombre: string | null = null
  if (dc.data && asignado) {
    const { data: acc, error: errAcc } = await supabase
      .from('concepto_pago_acceso')
      .select('perfil_corriente_id, perfil_corriente_nombre, perfil_moroso_id, perfil_moroso_nombre')
      .eq('concepto_pago_id', dc.data.concepto_id)
      .maybeSingle()
    if (errAcc) throw new Error(`No se pudo leer el acceso del concepto: ${errAcc.message}`)
    if (acc?.perfil_corriente_id === asignado) nombre = acc.perfil_corriente_nombre
    else if (acc?.perfil_moroso_id === asignado) nombre = acc.perfil_moroso_nombre
  }

  const { data: deseado, error: errDeseado } = await supabase.rpc('perfil_deseado', { p_domicilio_id: domicilioId })
  if (errDeseado) throw new Error(`No se pudo calcular el permiso del domicilio: ${errDeseado.message}`)
  return { nombre, pendiente: (deseado ?? null) !== (asignado ?? null) }
}

export type EstadoAccesoDomicilio = {
  es_moroso: boolean
  acceso_forzado: string | null
  forzado_por_nombre: string | null
  forzado_en: string | null
}

/** Morosidad y ajuste manual del domicilio (RPC solo para administrador y tesorero). */
export async function getEstadoAccesoDomicilio(
  supabase: SupabaseClient<Database>,
  domicilioId: number,
): Promise<EstadoAccesoDomicilio | null> {
  const { data, error } = await supabase.rpc('estado_acceso_domicilio', { p_domicilio_id: domicilioId })
  if (error) throw new Error(`No se pudo leer el estado de acceso: ${error.message}`)
  return data?.[0] ?? null
}
