import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/env'
import type { Database } from '@/lib/supabase/types'

export type ResultadoAuthApp =
  | { ok: true; userId: string; supabase: SupabaseClient<Database> }
  | { ok: false; status: 401 | 400 | 500 }
  | { ok: false; status: 403; codigo: 'otro_dispositivo' }

const NO_AUTORIZADO = { ok: false, status: 401 } as const
const SIN_DISPOSITIVO = { ok: false, status: 400 } as const
const OTRO_DISPOSITIVO = { ok: false, status: 403, codigo: 'otro_dispositivo' } as const
const ERROR_DISPOSITIVO = { ok: false, status: 500 } as const

export const MENSAJE_OTRO_DISPOSITIVO =
  'Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue.'

const limpiar = (valor: string | null) =>
  (valor ?? '').replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Autentica a un residente de la app móvil por `Authorization: Bearer <token>`. Devuelve un
 * cliente que actúa con el token (RLS del residente). Exige cuenta de residente activa y el header
 * `X-Device-Id`: el primer dispositivo que llega queda ligado a la cuenta (service-role); otro ⇒ 403.
 */
export async function autenticarResidente(request: Request): Promise<ResultadoAuthApp> {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!match) return NO_AUTORIZADO
  const token = match[1]
  const deviceId = limpiar(request.headers.get('x-device-id'))
  if (deviceId.length < 8 || deviceId.length > 100) return SIN_DISPOSITIVO
  try {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return NO_AUTORIZADO
    const userId = data.user.id
    const { data: cuenta, error: errCuenta } = await supabase
      .from('cuentas_residente')
      .select('activo')
      .eq('user_id', userId)
      .maybeSingle()
    if (errCuenta || !cuenta?.activo) return NO_AUTORIZADO
    const nombre = limpiar(request.headers.get('x-device-name')).slice(0, 80).trim() || null
    const ligado = await verificarDispositivo(userId, deviceId, nombre)
    if (ligado !== true) return ligado
    return { ok: true, userId, supabase }
  } catch {
    return NO_AUTORIZADO
  }
}

/** Liga el dispositivo en el primer uso; `true` si `deviceId` es el ligado. */
async function verificarDispositivo(userId: string, deviceId: string, nombre: string | null) {
  const admin = createAdminClient()
  const leer = () =>
    admin.from('dispositivos_residente').select('device_id').eq('user_id', userId).maybeSingle()
  let { data: fila, error } = await leer()
  if (error) return ERROR_DISPOSITIVO
  if (!fila) {
    const { error: errInsert } = await admin
      .from('dispositivos_residente')
      .insert({ user_id: userId, device_id: deviceId, nombre })
    if (!errInsert) return true
    // Carrera: otra petición ligó primero; se compara con lo que quedó.
    if (errInsert.code !== '23505') return ERROR_DISPOSITIVO
    ;({ data: fila, error } = await leer())
    if (error || !fila) return ERROR_DISPOSITIVO
  }
  return fila.device_id === deviceId ? (true as const) : OTRO_DISPOSITIVO
}

/** Respuesta JSON para un `autenticarResidente` fallido. */
export function respuestaAuth(auth: Extract<ResultadoAuthApp, { ok: false }>): Response {
  if (auth.status === 403) return Response.json({ error: MENSAJE_OTRO_DISPOSITIVO, codigo: auth.codigo }, { status: 403 })
  if (auth.status === 400) return jsonError(400, 'Falta el header X-Device-Id')
  if (auth.status === 500) return jsonError(500, 'No se pudo verificar el dispositivo')
  return jsonError(401, 'No autorizado')
}

export const jsonError = (status: number, error: string) => Response.json({ error }, { status })

/** `App · <nombre>` sin caracteres de control y recortado a 120. */
export function requestedBy(nombre: string | null | undefined): string {
  const limpio = limpiar(nombre ?? null)
  return `App · ${limpio || 'Residente'}`.slice(0, 120).trim()
}
