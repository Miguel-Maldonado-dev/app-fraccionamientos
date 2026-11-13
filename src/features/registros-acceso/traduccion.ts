import type { Log } from '@/lib/access-core/tipos'

export const ORIGENES: Record<0 | 1 | 2 | 3 | 4 | 5, string> = {
  0: 'Tarjeta',
  1: 'Control',
  2: 'Botón de salida',
  3: 'PIN',
  4: 'Remota (app)',
  5: 'Prueba',
}

export const MOTIVOS: Record<number, string> = {
  0: 'Permitido',
  1: 'Tarjeta desconocida',
  2: 'Sin salida',
  3: 'Sin permiso',
  4: 'Error de comunicación',
  5: 'Control desconocido',
  6: 'Botón sin salida',
  7: 'Botón de salida',
  8: 'PIN desconocido',
  9: 'PIN no permitido',
  10: 'PIN bloqueado',
  11: 'Titular desconocido',
}

export type FilaRegistro = {
  id: number
  fechaHora: string
  panel: string
  titular: string
  origen: string
  credencial: string
  salida: string
  permitido: boolean
  resultado: 'Permitido' | 'Denegado'
  motivo: string
}

const RAYA = '—'

/** Hora de pared tal como viene en `ts` (sin convertir zona): `dd/mm/aaaa HH:mm:ss`. */
export function formatearTs(ts: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(ts)
  if (!m) return ts
  // access-core manda `ts` en UTC (`Z`): con zona se convierte a la hora local (America/Mexico_City).
  // Sin zona se toma tal cual, como hora de pared.
  if (m[7]) {
    const fecha = new Date(ts)
    if (!Number.isNaN(fecha.getTime())) return fechaHoraMexico(fecha)
  }
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}`
}

export function traducirLog(log: Log, domicilioPorTitular: Map<string, string>): FilaRegistro {
  const titular =
    (log.holder_id ? domicilioPorTitular.get(log.holder_id) : undefined) || log.holder_name || RAYA
  const credencial = log.credential_label || (log.code != null ? String(log.code) : RAYA)
  const salida = log.output_alias || (log.output_index != null ? `Salida ${log.output_index}` : RAYA)
  return {
    id: log.id,
    fechaHora: formatearTs(log.ts),
    panel: log.panel_code || RAYA,
    titular,
    origen: ORIGENES[log.source] ?? RAYA,
    credencial,
    salida,
    permitido: log.allowed,
    resultado: log.allowed ? 'Permitido' : 'Denegado',
    motivo: MOTIVOS[log.reason] ?? RAYA,
  }
}

/** `dd/mm/aaaa HH:mm:ss` en America/Mexico_City (mismo formato que las filas). */
export function fechaHoraMexico(fecha: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Mexico_City',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  )
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}:${partes.second}`
}
