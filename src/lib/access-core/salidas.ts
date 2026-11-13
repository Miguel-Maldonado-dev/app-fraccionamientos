import 'server-only'
import { llamar } from './http'

export type ResultadoApertura = {
  command_id: string
  status: 'opened' | 'denied' | 'failed' | 'timeout'
  /** Código del panel (0–255): 0 abierta, 2 salida inexistente, 3 sin permiso, 4 relevador, 11 titular desconocido. */
  reason: number | null
  /** Texto del panel en español; nulo en `timeout`. */
  detail: string | null
}

/** Texto para la auditoría: el detalle del panel y su código de motivo, si vienen. */
export function describirApertura({ reason, detail }: Pick<ResultadoApertura, 'reason' | 'detail'>): string | null {
  const motivo = reason === null || reason === undefined ? null : `motivo ${reason}`
  if (detail && motivo) return `${detail} (${motivo})`
  return detail || motivo
}

/** Abre una salida de la instalación. Sin reintentos; `Idempotency-Key` nuevo por llamada. */
export const abrirSalida = (
  instalacionId: string,
  salidaId: string,
  { holderId, requestedBy }: { holderId: string; requestedBy: string },
) =>
  llamar<ResultadoApertura>(
    'POST',
    `/installations/${encodeURIComponent(instalacionId)}/outputs/${encodeURIComponent(salidaId)}/open`,
    { cuerpo: { holder_id: holderId, requested_by: requestedBy }, idempotencyKey: crypto.randomUUID() },
  )
