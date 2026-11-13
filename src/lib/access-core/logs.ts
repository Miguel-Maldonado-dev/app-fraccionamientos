import 'server-only'
import { llamar } from './http'
import type { Log } from './tipos'

export type FiltrosApi = {
  desde: string
  hasta: string
  panel?: string
  titular?: string
  resultado?: 'permitido' | 'denegado'
  origen?: '0' | '1' | '2' | '3' | '4' | '5'
  pagina: number
}

export type PaginaLogs = { data: Log[]; page: number; page_size: number; total: number }

/** Una página de registros de acceso (50 por página). Omite los filtros vacíos. */
export async function listarLogs(instalacionId: string, filtros: FiltrosApi): Promise<PaginaLogs> {
  const params: [string, string | undefined][] = [
    ['desde', filtros.desde],
    ['hasta', filtros.hasta],
    ['panel', filtros.panel],
    ['titular', filtros.titular],
    ['resultado', filtros.resultado],
    ['origen', filtros.origen],
    ['pagina', String(filtros.pagina)],
  ]
  const query = params
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&')
  const r = await llamar<PaginaLogs | undefined>('GET', `/installations/${encodeURIComponent(instalacionId)}/logs?${query}`, {
    completo: true,
  })
  return {
    data: Array.isArray(r?.data) ? r.data : [],
    page: r?.page ?? filtros.pagina,
    page_size: r?.page_size ?? 50,
    total: r?.total ?? 0,
  }
}
