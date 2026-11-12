import 'server-only'
import { llamar } from './http'
import type { Perfil } from './tipos'

export const listarPerfiles = (instalacionId: string) =>
  llamar<Perfil[]>('GET', `/installations/${instalacionId}/profiles`)

/** Reemplaza el conjunto de titulares del perfil. */
export const asignarTitulares = (instalacionId: string, perfilId: string, holderIds: string[], idempotencyKey: string) =>
  llamar<Perfil>('PUT', `/installations/${instalacionId}/profiles/${perfilId}/holders`, {
    cuerpo: { holder_ids: holderIds },
    idempotencyKey,
  })
