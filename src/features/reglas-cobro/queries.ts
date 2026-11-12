import { getTenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { REGLAS_COBRO_POR_OMISION, type ReglasCobro } from './schemas'

/**
 * Reglas del fraccionamiento (`null` = el del usuario; la consola pasa el id). Sin fila: valores por omisión.
 */
export async function obtenerReglasCobro(fraccionamientoId: number | null): Promise<ReglasCobro> {
  const fid = fraccionamientoId ?? (await getTenantContext())?.fraccionamiento?.id
  if (fid == null) return REGLAS_COBRO_POR_OMISION
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reglas_cobro')
    .select('dia_generacion, dia_vencimiento, dias_gracia, cuotas_para_moroso, concepto_recargo_id')
    .eq('fraccionamiento_id', fid)
    .maybeSingle()
  if (error) throw new Error(`No se pudieron leer las reglas de cobro: ${error.message}`)
  if (!data) return REGLAS_COBRO_POR_OMISION
  return {
    diaGeneracion: data.dia_generacion,
    diaVencimiento: data.dia_vencimiento,
    diasGracia: data.dias_gracia,
    cuotasParaMoroso: data.cuotas_para_moroso,
    conceptoRecargoId: data.concepto_recargo_id,
  }
}
