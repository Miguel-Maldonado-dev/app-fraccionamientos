import 'server-only'
import { llamar } from './http'
import type { TarjetaCrear } from './tipos'

const base = (instalacionId: string) => `/installations/${instalacionId}/cards`

export const crearTarjeta = (instalacionId: string, cuerpo: TarjetaCrear, idempotencyKey: string) =>
  llamar<{ id: string }>('POST', base(instalacionId), { cuerpo, idempotencyKey })

export const editarTarjeta = (
  instalacionId: string,
  id: string,
  cuerpo: { description: string },
  idempotencyKey: string,
) => llamar<{ id: string }>('PATCH', `${base(instalacionId)}/${id}`, { cuerpo, idempotencyKey })

export const borrarTarjeta = (instalacionId: string, id: string, idempotencyKey: string) =>
  llamar<{ id: string }>('DELETE', `${base(instalacionId)}/${id}`, { idempotencyKey })
