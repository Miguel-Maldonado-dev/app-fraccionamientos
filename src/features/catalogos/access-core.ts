import * as api from '@/lib/access-core'

export type PerfilOpcion = { id: string; nombre: string }

/** Perfiles (permisos) de la instalación; `null` si la API falla o no está configurada. */
export async function listarPerfilesDe(instalacionId: string): Promise<PerfilOpcion[] | null> {
  try {
    const perfiles = await api.listarPerfiles(instalacionId)
    return perfiles.map((p) => ({ id: p.id, nombre: p.name }))
  } catch (error) {
    console.error(error)
    return null
  }
}
