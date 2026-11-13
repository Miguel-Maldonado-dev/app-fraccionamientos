import type { SupabaseClient } from '@supabase/supabase-js'
import * as api from '@/lib/access-core'
import type { Database } from '@/lib/supabase/database.types'
import { ESTILOS, type BotonApp, type Estilo, type Icono, type SalidaApp } from './schemas'

const estiloValido = (e: string | null | undefined): Estilo =>
  (ESTILOS as readonly string[]).includes(e ?? '') ? (e as Estilo) : 'azul_claro'

export async function listBotonesApp(
  supabase: SupabaseClient<Database>,
  fraccionamientoId: number,
): Promise<BotonApp[]> {
  const { data, error } = await supabase
    .from('app_botones')
    .select('id, orden, nombre, icono, estilo, ancho_completo, salida_id, salida_nombre')
    .eq('fraccionamiento_id', fraccionamientoId)
    .order('orden')
  if (error) throw new Error(error.message)
  return (data ?? []).map((b) => ({ ...b, icono: b.icono as Icono, estilo: estiloValido(b.estilo) }))
}

/** Salidas habilitadas de la instalación; `null` si access-core falla o no está configurado. */
export async function listarSalidasApp(instalacionId: string): Promise<SalidaApp[] | null> {
  try {
    const salidas = await api.listarSalidas(instalacionId)
    return salidas.map((s) => ({
      id: s.id,
      alias: s.alias || `Salida ${s.output_index + 1}`,
    }))
  } catch (error) {
    console.error(error)
    return null
  }
}
