import 'server-only'
import { llamar } from './http'
import type { Instalacion, Panel, Salida } from './tipos'

export const listarInstalaciones = () => llamar<Instalacion[]>('GET', '/installations')

export const obtenerInstalacion = (id: string) => llamar<Instalacion>('GET', `/installations/${id}`)

export const listarPaneles = (instalacionId: string) =>
  llamar<Panel[]>('GET', `/installations/${instalacionId}/panels`)

export const listarSalidas = (instalacionId: string) =>
  llamar<Salida[]>('GET', `/installations/${instalacionId}/outputs`)
