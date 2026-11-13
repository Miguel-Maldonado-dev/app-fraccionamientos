import { api } from './api'

export type BotonEstado = {
  id: number
  orden: number
  nombre: string
  icono: string
  ancho_completo: boolean
  habilitado: boolean
  /** 'azul' | 'azul_claro' | 'navy' | 'turquesa'; ausente en servidores viejos ⇒ azul_claro. */
  estilo?: string
}
export type EstadoDomicilio = {
  domicilio: { id: number; direccion: string }
  fraccionamiento: { nombre: string }
  moroso: boolean
  pin: string | null
  botones: BotonEstado[]
}
export type StatusApertura = 'opened' | 'denied' | 'failed' | 'timeout'
export type ResidenteApp = { id: number; nombre: string; telefono: string; es_principal: boolean; con_acceso: boolean }

export const cargarEstado = (id: number) => api<EstadoDomicilio>(`/api/app/domicilios/${id}/estado`)
export const abrir = (domicilioId: number, botonId: number) =>
  api<{ status: StatusApertura }>(`/api/app/domicilios/${domicilioId}/aperturas`, {
    method: 'POST',
    body: JSON.stringify({ botonId }),
  })
