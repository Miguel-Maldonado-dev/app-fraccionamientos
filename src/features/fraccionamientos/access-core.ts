import type { SupabaseClient } from '@supabase/supabase-js'
import * as api from '@/lib/access-core'
import type { Database } from '@/lib/supabase/database.types'
import { listInstalacionesEnUso } from './queries'

export type InstalacionOpcion = { id: string; nombre: string }
export type SalidaOpcion = { panelId: string; panelCodigo: string; salida: 0 | 1 | 2 | 3; alias: string }

/**
 * Instalaciones de la API que ningún fraccionamiento tiene vinculadas. Devuelve `null` si la API
 * falla o no está configurada: la pantalla lo muestra como "No se pudo consultar access-core".
 */
export async function listarInstalacionesDisponibles(
  supabase: SupabaseClient<Database>,
): Promise<InstalacionOpcion[] | null> {
  try {
    const [todas, enUso] = await Promise.all([api.listarInstalaciones(), listInstalacionesEnUso(supabase)])
    const usadas = new Set(enUso)
    return todas.filter((i) => !usadas.has(i.id)).map((i) => ({ id: i.id, nombre: i.name }))
  } catch (error) {
    console.error(error)
    return null
  }
}

/** Salidas de la instalación con el código de su panel; `null` si la API falla. */
export async function listarSalidasDe(instalacionId: string): Promise<SalidaOpcion[] | null> {
  try {
    const [salidas, paneles] = await Promise.all([api.listarSalidas(instalacionId), api.listarPaneles(instalacionId)])
    const codigos = new Map(paneles.map((p) => [p.id, p.panel_code]))
    return salidas.map((s) => ({
      panelId: s.panel_id,
      panelCodigo: codigos.get(s.panel_id) ?? s.panel_id,
      salida: s.output_index as SalidaOpcion['salida'],
      alias: s.alias,
    }))
  } catch (error) {
    console.error(error)
    return null
  }
}
