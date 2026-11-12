import 'server-only'
import { llamar } from './http'
import type { Control, ControlCuerpo } from './tipos'

const base = (instalacionId: string) => `/installations/${instalacionId}/controls`

export const crearControl = (instalacionId: string, cuerpo: ControlCuerpo, idempotencyKey: string) =>
  llamar<Control>('POST', base(instalacionId), { cuerpo, idempotencyKey })

export const reemplazarControl = (instalacionId: string, id: string, cuerpo: ControlCuerpo, idempotencyKey: string) =>
  llamar<Control>('PUT', `${base(instalacionId)}/${id}`, { cuerpo, idempotencyKey })

export const borrarControl = (instalacionId: string, id: string, idempotencyKey: string) =>
  llamar<{ id: string }>('DELETE', `${base(instalacionId)}/${id}`, { idempotencyKey })
