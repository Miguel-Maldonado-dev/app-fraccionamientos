import 'server-only'
import { leerConfig } from './config'
import { AccessCoreError } from './errores'

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const TIMEOUT_MS = 10_000

/**
 * Llama a la API de access-core. Devuelve `data` de los sobres `{data, revision}`,
 * `undefined` si no hay cuerpo (204) y lanza `AccessCoreError` en cualquier fallo.
 */
export async function llamar<T>(
  metodo: Metodo,
  ruta: string,
  opciones: { cuerpo?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const { url, apiKey } = leerConfig()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (opciones.idempotencyKey) headers['Idempotency-Key'] = opciones.idempotencyKey

  let res: Response
  try {
    res = await fetch(`${url}${ruta}`, {
      method: metodo,
      headers,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    throw new AccessCoreError(0, 'network_error', `No se pudo conectar con access-core: ${detalle}`)
  }

  const texto = await res.text().catch(() => '')
  let json: unknown
  if (texto) {
    try {
      json = JSON.parse(texto)
    } catch {
      json = undefined
    }
  }

  if (!res.ok) {
    const err = (json ?? {}) as { code?: string; message?: string }
    const retry = Number(res.headers.get('Retry-After'))
    throw new AccessCoreError(
      res.status,
      err.code ?? 'unknown_error',
      err.message ?? `access-core respondió ${res.status}`,
      Number.isFinite(retry) && res.headers.get('Retry-After') ? retry : undefined,
    )
  }

  if (json === undefined) return undefined as T
  if (typeof json === 'object' && json !== null && 'data' in json) return (json as { data: T }).data
  return json as T
}
