import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import { passwordValida } from './cuentas'
import { prepararEliminacionConAcceso, validarMaximoCon, vincularCuenta } from './acceso-app'
import {
  MSG_PASSWORD_CORTA,
  MSG_TELEFONO_INVALIDO,
  MSG_TELEFONO_YA_EN_DOMICILIO,
} from './messages'
import { normalizarTelefono } from './telefono'

/*
 * Gestión de residentes desde la app móvil por el residente principal del domicilio. Cada función
 * valida primero con el cliente del residente (RLS + `user_id = auth.uid()` + `es_principal`) y solo
 * entonces usa el service-role. Comparte con el personal el núcleo de `./acceso-app`.
 */
type Cliente = SupabaseClient<Database>

export type ResidenteApp = { id: number; nombre: string; telefono: string | null; es_principal: boolean; con_acceso: boolean }

export type Resultado<T> = { ok: true; data: T } | { ok: false; status: 403 | 404 | 422; error: string }

export const MSG_DOMICILIO_NO_ENCONTRADO = 'Domicilio no encontrado'
export const MSG_SOLO_PRINCIPAL = 'Solo el residente principal puede administrar residentes'
export const MSG_NO_QUITARSE = 'No puedes quitarte a ti mismo'
export const MSG_RESIDENTE_NO_ENCONTRADO_APP = 'Residente no encontrado'
export const MSG_NOMBRE_REQUERIDO = 'El nombre es obligatorio'

const falla = (status: 403 | 404 | 422, error: string) => ({ ok: false, status, error }) as const

type Yo = { id: number; es_principal: boolean | null; fraccionamiento_id: number }

/** La fila del propio residente en el domicilio (cliente del residente), o `null` si no es suyo. */
async function yoEnDomicilio(supabase: Cliente, userId: string, domicilioId: number): Promise<Yo | null> {
  const { data, error } = await supabase
    .from('residentes')
    .select('id, es_principal, fraccionamiento_id')
    .eq('domicilio_id', domicilioId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function exigirPrincipal(supabase: Cliente, userId: string, domicilioId: number): Promise<Resultado<Yo>> {
  const yo = await yoEnDomicilio(supabase, userId, domicilioId)
  if (!yo) return falla(404, MSG_DOMICILIO_NO_ENCONTRADO)
  if (!yo.es_principal) return falla(403, MSG_SOLO_PRINCIPAL)
  return { ok: true, data: yo }
}

export async function listarResidentesDomicilio(
  supabase: Cliente,
  userId: string,
  domicilioId: number,
): Promise<Resultado<ResidenteApp[]>> {
  if (!(await yoEnDomicilio(supabase, userId, domicilioId))) return falla(404, MSG_DOMICILIO_NO_ENCONTRADO)
  const { data, error } = await supabase
    .from('residentes')
    .select('id, nombre, telefono, es_principal, user_id')
    .eq('domicilio_id', domicilioId)
    .order('es_principal', { ascending: false })
    .order('nombre')
  if (error) throw new Error(error.message)
  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      telefono: r.telefono,
      es_principal: r.es_principal === true,
      con_acceso: r.user_id !== null,
    })),
  }
}

export type AgregarInput = { nombre?: unknown; telefono?: unknown; password?: unknown }

export async function agregarResidentePorPrincipal(
  supabase: Cliente,
  userId: string,
  domicilioId: number,
  input: AgregarInput,
): Promise<Resultado<{ id: number; cuentaCreada: boolean }>> {
  const permiso = await exigirPrincipal(supabase, userId, domicilioId)
  if (!permiso.ok) return permiso
  const fraccionamientoId = permiso.data.fraccionamiento_id

  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : ''
  if (!nombre || nombre.length > 200) return falla(422, MSG_NOMBRE_REQUERIDO)
  const telefono = normalizarTelefono(typeof input.telefono === 'string' ? input.telefono : '')
  if (!telefono) return falla(422, MSG_TELEFONO_INVALIDO)
  const password = typeof input.password === 'string' && input.password ? input.password : undefined
  if (password !== undefined && !passwordValida(password)) return falla(422, MSG_PASSWORD_CORTA)

  // Validado el principal: a partir de aquí service-role.
  const admin = createAdminClient()
  const maximo = await validarMaximoCon(admin, fraccionamientoId, domicilioId)
  if (!maximo.ok) return falla(422, maximo.error)

  // Antes de insertar: si el teléfono ya tiene cuenta con acceso en el domicilio, no se crea nada.
  const { data: cuenta, error: cuentaError } = await admin
    .from('cuentas_residente')
    .select('user_id')
    .eq('telefono', telefono)
    .maybeSingle()
  if (cuentaError) throw new Error(cuentaError.message)
  if (cuenta) {
    const { count, error } = await admin
      .from('residentes')
      .select('id', { count: 'exact', head: true })
      .eq('domicilio_id', domicilioId)
      .eq('user_id', cuenta.user_id)
    if (error) throw new Error(error.message)
    if ((count ?? 0) > 0) return falla(422, MSG_TELEFONO_YA_EN_DOMICILIO)
  }

  const { data: nuevo, error: insertError } = await admin
    .from('residentes')
    .insert({ nombre, telefono, domicilio_id: domicilioId, fraccionamiento_id: fraccionamientoId })
    .select('id')
    .single()
  if (insertError) throw new Error(insertError.message)

  const residente = { id: nuevo.id, telefono, domicilio_id: domicilioId, fraccionamiento_id: fraccionamientoId, user_id: null }
  let vinculo: Awaited<ReturnType<typeof vincularCuenta>>
  try {
    vinculo = await vincularCuenta(admin, residente, telefono, password)
  } catch (e) {
    await admin.from('residentes').delete().eq('id', nuevo.id)
    throw e
  }
  if (!vinculo.ok) {
    const { error } = await admin.from('residentes').delete().eq('id', nuevo.id)
    if (error) console.error('agregarResidentePorPrincipal: no se pudo revertir el alta', error)
    return falla(422, vinculo.error)
  }
  return { ok: true, data: { id: nuevo.id, cuentaCreada: vinculo.data.cuentaCreada } }
}

export async function quitarResidentePorPrincipal(
  supabase: Cliente,
  userId: string,
  domicilioId: number,
  residenteId: number,
): Promise<Resultado<null>> {
  const permiso = await exigirPrincipal(supabase, userId, domicilioId)
  if (!permiso.ok) return permiso
  if (permiso.data.id === residenteId) return falla(422, MSG_NO_QUITARSE)

  // Visible con el cliente del residente y del mismo domicilio.
  const { data: objetivo, error } = await supabase
    .from('residentes')
    .select('id, user_id')
    .eq('id', residenteId)
    .eq('domicilio_id', domicilioId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!objetivo) return falla(404, MSG_RESIDENTE_NO_ENCONTRADO_APP)
  if (objetivo.user_id === userId) return falla(422, MSG_NO_QUITARSE)

  const admin = createAdminClient()
  // Misma limpieza que `eliminarResidenteEn`: teléfonos automáticos y cuenta sin domicilios.
  const despues = objetivo.user_id ? await prepararEliminacionConAcceso(residenteId, objetivo.user_id, admin) : null
  const { error: delError } = await admin
    .from('residentes')
    .delete()
    .eq('id', residenteId)
    .eq('domicilio_id', domicilioId)
  if (delError) throw new Error(delError.message)
  if (despues) await despues()
  return { ok: true, data: null }
}
