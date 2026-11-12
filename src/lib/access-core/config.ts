import 'server-only'
import { AccessCoreNoConfigurado } from './errores'

const URL_POR_DEFECTO = 'https://access-core-cloud.vercel.app/api/v1'

/** Lee la configuración al llamar, nunca al cargar el módulo. */
export function leerConfig(): { url: string; apiKey: string } {
  const apiKey = process.env.ACCESS_CORE_API_KEY
  if (!apiKey) throw new AccessCoreNoConfigurado()
  const url = (process.env.ACCESS_CORE_API_URL || URL_POR_DEFECTO).replace(/\/+$/, '')
  return { url, apiKey }
}
