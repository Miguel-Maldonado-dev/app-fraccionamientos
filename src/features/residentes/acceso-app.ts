import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { desactivarSiSinDomicilios, obtenerOCrearCuenta, passwordValida, restablecerPassword } from './cuentas'
import {
  MSG_CUENTA_EN_OTRO_FRACCIONAMIENTO,
  MSG_ERROR_CUENTA,
  MSG_PASSWORD_CORTA,
  MSG_PASSWORD_REQUERIDA,
  MSG_RESIDENTE_NO_ENCONTRADO,
  MSG_SIN_ACCESO_APP,
  MSG_TELEFONO_INVALIDO,
  MSG_TELEFONO_YA_EN_DOMICILIO,
  msgMaximoResidentesApp,
} from './messages'
import { normalizarTelefono } from './telefono'
import { sincronizarTelefonoAcceso } from './telefono-acceso'

/*
 * Lógica del acceso a la app de residentes, compartida por `./cuentas-actions` y `./actions`.
 * No es `'use server'`: no verifica rol. Cada función valida primero con el cliente del usuario
 * (RLS) que el residente es de su fraccionamiento; solo entonces usa el cliente service-role,
 * necesario porque `residentes.user_id` y `cuentas_residente` no los escribe `authenticated`.
 */

export type DarAccesoInput = { telefono: string; password?: string }
export type ResultadoAcceso = { cuentaCreada: boolean }

export type ResidenteVisible = { id: number; telefono: string | null; domicilio_id: number; fraccionamiento_id: number; user_id: string | null }

/** El residente visible con el cliente del usuario, o `null` si no existe o es de otro fraccionamiento. */
async function residenteVisible(residenteId: number): Promise<ResidenteVisible | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('residentes')
    .select('id, telefono, domicilio_id, fraccionamiento_id, user_id')
    .eq('id', residenteId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function revalidar(domicilioId: number) {
  revalidatePath(`/domicilios/${domicilioId}`)
  revalidatePath('/residentes')
}

/** Verifica con el cliente del usuario que el domicilio no llegó al máximo de residentes con app. */
async function validarMaximo(residente: ResidenteVisible): Promise<ActionResult> {
  return validarMaximoCon(await createClient(), residente.fraccionamiento_id, residente.domicilio_id)
}

/**
 * Verifica que el domicilio no llegó al máximo de residentes con app. `client` es el del usuario
 * (personal) o el service-role (cuando ya se validó al residente principal).
 */
export async function validarMaximoCon(
  client: SupabaseClient<Database>,
  fraccionamientoId: number,
  domicilioId: number,
): Promise<ActionResult> {
  const { data: fracc, error: fraccError } = await client
    .from('fraccionamientos')
    .select('max_residentes_app')
    .eq('id', fraccionamientoId)
    .single()
  if (fraccError) throw new Error(fraccError.message)
  const { data: conCuenta, error } = await client.rpc('residentes_con_cuenta', { p_domicilio_id: domicilioId })
  if (error) throw new Error(error.message)
  if ((conCuenta ?? 0) >= fracc.max_residentes_app) return fail(msgMaximoResidentesApp(fracc.max_residentes_app))
  return ok(undefined)
}

export async function darAccesoAppEn(
  residenteId: number,
  input: DarAccesoInput,
): Promise<ActionResult<ResultadoAcceso>> {
  const telefono = normalizarTelefono(input.telefono ?? '')
  if (!telefono) return fail(MSG_TELEFONO_INVALIDO)
  const password = input.password || undefined
  if (password !== undefined && !passwordValida(password)) return fail(MSG_PASSWORD_CORTA)

  const residente = await residenteVisible(residenteId)
  if (!residente) return fail(MSG_RESIDENTE_NO_ENCONTRADO)

  // Si ya tiene cuenta ocupa su lugar: cambiar de teléfono no cuenta contra el máximo.
  if (residente.user_id === null) {
    const maximo = await validarMaximo(residente)
    if (!maximo.ok) return maximo
  }

  const r = await vincularCuenta(createAdminClient(), residente, telefono, password)
  if (r.ok) revalidar(residente.domicilio_id)
  return r
}

/**
 * Núcleo compartido (personal y residente principal): obtiene o crea la cuenta del teléfono y la
 * vincula al residente, con su teléfono de acceso. `telefono` ya normalizado. El llamador ya validó
 * el permiso sobre el residente y el máximo; `admin` es el cliente service-role.
 */
export async function vincularCuenta(
  admin: SupabaseClient<Database>,
  residente: ResidenteVisible,
  telefono: string,
  password: string | undefined,
): Promise<ActionResult<ResultadoAcceso>> {
  const cuenta = await obtenerOCrearCuenta(admin, { telefono, password })
  if (!cuenta.ok) {
    if (cuenta.motivo === 'password_requerida') return fail(MSG_PASSWORD_REQUERIDA)
    if (cuenta.motivo === 'password_invalida') return fail(MSG_PASSWORD_CORTA)
    return fail(MSG_ERROR_CUENTA)
  }

  const { data: otros, error: otrosError } = await admin
    .from('residentes')
    .select('id')
    .eq('domicilio_id', residente.domicilio_id)
    .eq('user_id', cuenta.userId)
    .neq('id', residente.id)
  if (otrosError) throw new Error(otrosError.message)
  if ((otros ?? []).length > 0) return fail(MSG_TELEFONO_YA_EN_DOMICILIO)

  const { error } = await admin
    .from('residentes')
    .update({ user_id: cuenta.userId, telefono })
    .eq('id', residente.id)
  if (error) {
    if (error.code === '23505') return fail(MSG_TELEFONO_YA_EN_DOMICILIO)
    throw new Error(error.message)
  }

  // Cambio de teléfono: la cuenta anterior puede quedar sin domicilios.
  if (residente.user_id !== null && residente.user_id !== cuenta.userId) {
    await desactivarSiSinDomicilios(admin, residente.user_id)
  }

  await sincronizarTelefonoAcceso(admin, {
    residenteId: residente.id,
    domicilioId: residente.domicilio_id,
    fraccionamientoId: residente.fraccionamiento_id,
    telefonoAnterior: residente.user_id !== null ? residente.telefono : null,
    telefonoNuevo: telefono,
  })

  return ok({ cuentaCreada: cuenta.creada })
}

export async function quitarAccesoAppEn(residenteId: number): Promise<ActionResult> {
  const residente = await residenteVisible(residenteId)
  if (!residente) return fail(MSG_RESIDENTE_NO_ENCONTRADO)
  if (residente.user_id === null) return fail(MSG_SIN_ACCESO_APP)

  const admin = createAdminClient()
  const { error } = await admin.from('residentes').update({ user_id: null }).eq('id', residente.id)
  if (error) throw new Error(error.message)
  await desactivarSiSinDomicilios(admin, residente.user_id)

  await sincronizarTelefonoAcceso(admin, {
    residenteId: residente.id,
    domicilioId: residente.domicilio_id,
    fraccionamientoId: residente.fraccionamiento_id,
    telefonoAnterior: residente.telefono,
    telefonoNuevo: null,
  })

  revalidar(residente.domicilio_id)
  return ok(undefined)
}

export async function restablecerPasswordResidenteEn(residenteId: number, password: string): Promise<ActionResult> {
  if (!passwordValida(password ?? '')) return fail(MSG_PASSWORD_CORTA)
  const residente = await residenteVisible(residenteId)
  if (!residente) return fail(MSG_RESIDENTE_NO_ENCONTRADO)
  if (residente.user_id === null) return fail(MSG_SIN_ACCESO_APP)

  // La cuenta es global (una por teléfono): si también está vinculada en otro fraccionamiento,
  // este staff no puede tomar control de ella cambiando su contraseña.
  const admin = createAdminClient()
  const { data: vinculos, error } = await admin
    .from('residentes')
    .select('fraccionamiento_id')
    .eq('user_id', residente.user_id)
  if (error) throw new Error(error.message)
  if ((vinculos ?? []).some((v) => v.fraccionamiento_id !== residente.fraccionamiento_id)) {
    return fail(MSG_CUENTA_EN_OTRO_FRACCIONAMIENTO)
  }
  return restablecerPassword(admin, residente.user_id, password)
}

/**
 * Limpieza previa a eliminar un residente con acceso a la app: borra los teléfonos de acceso que
 * se registraron automáticamente para él (al borrarlo, la FK pondría `residente_id` en null y ya
 * no se distinguirían de los registrados a mano). Devuelve una función para llamar tras el borrado,
 * que desactiva la cuenta si ya no tiene domicilios. El llamador ya validó el residente con RLS.
 */
export async function prepararEliminacionConAcceso(
  residenteId: number,
  userId: string,
  admin: SupabaseClient<Database> = createAdminClient(),
): Promise<() => Promise<void>> {
  const { error } = await admin.from('telefonos_acceso').delete().eq('residente_id', residenteId)
  if (error) throw new Error(error.message)
  return () => desactivarSiSinDomicilios(admin, userId)
}

/** Desliga el dispositivo de la cuenta del residente para que pueda iniciar sesión en otro teléfono. */
export async function desligarDispositivoEn(residenteId: number): Promise<ActionResult> {
  const residente = await residenteVisible(residenteId)
  if (!residente) return fail(MSG_RESIDENTE_NO_ENCONTRADO)
  if (residente.user_id === null) return fail(MSG_SIN_ACCESO_APP)

  const { error } = await createAdminClient().from('dispositivos_residente').delete().eq('user_id', residente.user_id)
  if (error) throw new Error(error.message)

  revalidar(residente.domicilio_id)
  return ok(undefined)
}
