import type { SupabaseClient } from '@supabase/supabase-js'
import { MEDIOS_HABILITABLES, TIPO_PAGO, type MedioAcceso } from '@/lib/constants'
import type { Database } from '@/lib/supabase/database.types'
import type { ElementoCatalogo, TipoCuota } from './catalogos'

type Accesos = Pick<
  Database['public']['Tables']['concepto_pago_acceso']['Row'],
  'medios' | 'perfil_corriente_id' | 'perfil_corriente_nombre' | 'perfil_moroso_id' | 'perfil_moroso_nombre'
>

/** Con `fraccionamientoId` (consola del super admin) filtra por él; sin él, RLS limita al del usuario. */
export async function listTiposCuota(
  supabase: SupabaseClient<Database>,
  fraccionamientoId?: number,
): Promise<TipoCuota[]> {
  let q = supabase
    .from('conceptos_pago')
    .select(
      'id, nombre, importe, concepto_pago_acceso(medios, perfil_corriente_id, perfil_corriente_nombre, perfil_moroso_id, perfil_moroso_nombre)',
    )
    .eq('tipo_pago_id', TIPO_PAGO.RECURRENTE)
  if (fraccionamientoId !== undefined) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.order('nombre', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los tipos de cuota: ${error.message}`)
  return (data ?? []).map((r) => {
    // PostgREST puede devolver la relación como arreglo u objeto; sin fila, sin medios ni permisos.
    const rel = r.concepto_pago_acceso as Accesos | Accesos[] | null
    const acceso = Array.isArray(rel) ? rel[0] : rel
    return {
      id: r.id,
      nombre: r.nombre,
      importe: Number(r.importe),
      medios: acceso?.medios ?? [],
      perfilCorrienteId: acceso?.perfil_corriente_id ?? null,
      perfilCorrienteNombre: acceso?.perfil_corriente_nombre ?? null,
      perfilMorosoId: acceso?.perfil_moroso_id ?? null,
      perfilMorosoNombre: acceso?.perfil_moroso_nombre ?? null,
    }
  })
}

export async function listConceptosExtraCatalogo(
  supabase: SupabaseClient<Database>,
  fraccionamientoId?: number,
): Promise<ElementoCatalogo[]> {
  let q = supabase.from('conceptos_pago').select('id, nombre, importe').eq('tipo_pago_id', TIPO_PAGO.EXTRA)
  if (fraccionamientoId !== undefined) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q.order('nombre', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los conceptos extra: ${error.message}`)
  return (data ?? []).map((r) => ({ id: r.id, nombre: r.nombre, importe: Number(r.importe) }))
}

/** Medios que el super admin habilitó, en el orden del catálogo. Sin id, RLS limita al fraccionamiento del usuario. */
export async function listMediosHabilitados(
  supabase: SupabaseClient<Database>,
  fraccionamientoId?: number,
): Promise<MedioAcceso[]> {
  let q = supabase.from('fraccionamiento_medios').select('medio')
  if (fraccionamientoId !== undefined) q = q.eq('fraccionamiento_id', fraccionamientoId)
  const { data, error } = await q
  if (error) throw new Error(`No se pudieron leer los medios habilitados: ${error.message}`)
  const habilitados = new Set((data ?? []).map((f) => f.medio as MedioAcceso))
  return MEDIOS_HABILITABLES.filter((m) => habilitados.has(m))
}
