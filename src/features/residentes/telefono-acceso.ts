import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type SincronizarTelefonoInput = {
  residenteId: number
  domicilioId: number
  fraccionamientoId: number
  telefonoAnterior: string | null
  telefonoNuevo: string | null
}

/*
 * El teléfono del residente con app pasa a ser un medio de acceso (`telefonos_acceso`) del
 * domicilio, si su tipo de cuota habilita el medio `telefono`. No se encola sincronización:
 * access-core no tiene API de teléfonos. Recibe el cliente service-role (los tesoreros no
 * escriben `telefonos_acceso` con RLS); el llamador ya validó que el domicilio es del usuario.
 */
export async function sincronizarTelefonoAcceso(
  client: SupabaseClient<Database>,
  { residenteId, domicilioId, fraccionamientoId, telefonoAnterior, telefonoNuevo }: SincronizarTelefonoInput,
): Promise<void> {
  if (!telefonoAnterior && !telefonoNuevo) return

  const { data: asignacion, error: asignacionError } = await client
    .from('domicilio_concepto')
    .select('concepto_id')
    .eq('domicilio_id', domicilioId)
    .maybeSingle()
  if (asignacionError) throw new Error(asignacionError.message)
  if (!asignacion) return

  const { data: acceso, error: accesoError } = await client
    .from('concepto_pago_acceso')
    .select('medios')
    .eq('concepto_pago_id', asignacion.concepto_id)
    .maybeSingle()
  if (accesoError) throw new Error(accesoError.message)
  if (!acceso?.medios.includes('telefono')) return

  if (telefonoAnterior && telefonoAnterior !== telefonoNuevo) {
    const { error } = await client
      .from('telefonos_acceso')
      .delete()
      .eq('domicilio_id', domicilioId)
      .eq('telefono', telefonoAnterior)
      .eq('residente_id', residenteId)
    if (error) throw new Error(error.message)
  }

  if (telefonoNuevo) {
    const { data: existente, error: existenteError } = await client
      .from('telefonos_acceso')
      .select('id')
      .eq('domicilio_id', domicilioId)
      .eq('telefono', telefonoNuevo)
      .limit(1)
    if (existenteError) throw new Error(existenteError.message)
    // Ya registrado (a mano o por este residente): no se reclama ni se duplica.
    if ((existente ?? []).length > 0) return
    const { error } = await client
      .from('telefonos_acceso')
      .insert({
        domicilio_id: domicilioId,
        telefono: telefonoNuevo,
        fraccionamiento_id: fraccionamientoId,
        residente_id: residenteId,
      })
    if (error) throw new Error(error.message)
  }
}
