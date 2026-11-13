import * as Device from 'expo-device'
import { obtenerDeviceId } from './dispositivo'
import { supabase } from './supabase'

export const MENSAJE_SIN_CONEXION = 'Sin conexión, intenta de nuevo'

export class ApiError extends Error {
  constructor(
    public status: number,
    public mensaje: string,
    public codigo?: string,
  ) {
    super(mensaje)
    this.name = 'ApiError'
  }
}

const baseUrl = () => (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '')

async function token(): Promise<string | undefined> {
  return (await supabase.auth.getSession()).data.session?.access_token
}

async function llamar(ruta: string, init: RequestInit, accessToken: string | undefined): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('X-Device-Id', await obtenerDeviceId())
  const nombre = Device.modelName
  if (nombre) headers.set('X-Device-Name', nombre.slice(0, 80))
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  try {
    return await fetch(`${baseUrl()}${ruta}`, { ...init, headers })
  } catch {
    throw new ApiError(0, MENSAJE_SIN_CONEXION)
  }
}

type ManejadorRechazo = (e: ApiError) => void
let manejadorRechazo: ManejadorRechazo | null = null

/**
 * Registra quién atiende un rechazo definitivo de la sesión (401 tras el reintento, o 403
 * `otro_dispositivo`) en cualquier llamada. Devuelve la función para quitarlo.
 */
export function alRechazarSesion(fn: ManejadorRechazo): () => void {
  manejadorRechazo = fn
  return () => {
    if (manejadorRechazo === fn) manejadorRechazo = null
  }
}

const esRechazoDeSesion = (e: ApiError) => e.status === 401 || (e.status === 403 && e.codigo === 'otro_dispositivo')

/** Hace la petición (con un reintento tras renovar en 401) y devuelve la respuesta ok o lanza `ApiError`. */
async function pedir(ruta: string, init: RequestInit): Promise<Response> {
  let res = await llamar(ruta, init, await token())
  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) res = await llamar(ruta, init, data.session.access_token)
  }
  if (!res.ok) {
    let cuerpo: { error?: string; codigo?: string } = {}
    try {
      cuerpo = await res.json()
    } catch {
      // cuerpo no JSON
    }
    const e = new ApiError(res.status, cuerpo.error ?? 'Ocurrió un error, intenta de nuevo', cuerpo.codigo)
    if (esRechazoDeSesion(e)) manejadorRechazo?.(e)
    throw e
  }
  return res
}

/**
 * Llama a una ruta `/api/app/*` con `Authorization` y `X-Device-Id`. En 401 renueva la sesión
 * una vez y reintenta. Errores ⇒ `ApiError { status, mensaje, codigo? }`; un 401 definitivo o un
 * 403 `otro_dispositivo` además avisa al manejador de `alRechazarSesion` (cierra sesión).
 */
export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await pedir(ruta, init)
  if (res.status === 204) return undefined as T
  const tipo = res.headers.get('Content-Type') ?? ''
  return (tipo.includes('application/json') ? await res.json() : await res.text()) as T
}

/** Como `api`, pero devuelve el cuerpo binario (p. ej. un PDF). */
export async function apiBinario(ruta: string, init: RequestInit = {}): Promise<ArrayBuffer> {
  return (await pedir(ruta, init)).arrayBuffer()
}
