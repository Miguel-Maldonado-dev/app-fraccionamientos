import 'server-only'
import { after } from 'next/server'
import { procesarSincronizaciones } from './worker'

/** Procesa la cola del fraccionamiento cuando termina la respuesta actual, sin bloquearla. */
export function dispararSincronizacion(fraccionamientoId: number): void {
  after(() => procesarSincronizaciones({ fraccionamientoId }).catch(console.error))
}
