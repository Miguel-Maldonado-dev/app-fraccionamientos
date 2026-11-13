import { ApiError } from './api'
import { api } from './api'
import { supabase } from './supabase'
import { correoSintetico, normalizarTelefono } from './telefono'

export type DomicilioYo = {
  id: number
  direccion: string
  fraccionamiento: string
  es_principal: boolean
  /** Nombre del residente en ese domicilio. */
  nombre: string
}
export type Yo = { telefono: string; domicilios: DomicilioYo[] }

export const MENSAJE_CREDENCIALES = 'Teléfono o contraseña incorrectos'
export const MENSAJE_SIN_ACCESO = 'Tu cuenta no tiene acceso a la app. Contacta a la administración.'
export const MENSAJE_OTRO_DISPOSITIVO =
  'Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue.'

export type ResultadoEntrar = { ok: true; yo: Yo } | { ok: false; mensaje: string }

export const MENSAJE_SIN_CONEXION = 'Sin conexión, intenta de nuevo'
export const MENSAJE_GENERICO = 'Ocurrió un error, intenta de nuevo'

/** Mensaje para un error de `signInWithPassword` según su status HTTP. */
export function mensajeErrorLogin(status: number | undefined): string {
  if (status === 429) return 'Demasiados intentos, espera un momento'
  if (status !== undefined && status >= 500) return MENSAJE_GENERICO
  if (status === 0) return MENSAJE_SIN_CONEXION
  return MENSAJE_CREDENCIALES
}

/** true si el error de `/api/app/yo` significa que la sesión no sirve y hay que cerrarla. */
export function debeCerrarSesion(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || (e.status === 403 && e.codigo === 'otro_dispositivo'))
}

/** Mapea un error de `/api/app/yo` al mensaje para el usuario (cerrando sesión antes). */
export function mensajeDeErrorYo(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return MENSAJE_SIN_ACCESO
    if (e.status === 403 && e.codigo === 'otro_dispositivo') return MENSAJE_OTRO_DISPOSITIVO
    return e.mensaje
  }
  return MENSAJE_GENERICO
}

export async function cargarYo(): Promise<Yo> {
  return api<Yo>('/api/app/yo')
}

/** Login con teléfono + contraseña; valida acceso con `GET /api/app/yo`. */
export async function entrar(telefono: string, password: string): Promise<ResultadoEntrar> {
  const tel = normalizarTelefono(telefono)
  if (!tel || !password) return { ok: false, mensaje: MENSAJE_CREDENCIALES }
  let error: unknown
  try {
    ;({ error } = await supabase.auth.signInWithPassword({ email: correoSintetico(tel), password }))
  } catch {
    return { ok: false, mensaje: MENSAJE_SIN_CONEXION }
  }
  if (error) {
    return { ok: false, mensaje: mensajeErrorLogin((error as { status?: number }).status) }
  }
  try {
    return { ok: true, yo: await cargarYo() }
  } catch (e) {
    await supabase.auth.signOut()
    return { ok: false, mensaje: mensajeDeErrorYo(e) }
  }
}
