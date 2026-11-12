import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type * as AccessCore from '@/lib/access-core'
import type { AccessCoreError, BotonCuerpo, Control } from '@/lib/access-core'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { Tarea } from './tipos'

export type Contexto = {
  admin: SupabaseClient<Database>
  instalacionId: string
  api: typeof AccessCore
}

export type Resultado = { ok: true } | { ok: false; error: AccessCoreError | Error }

export const MSG_NO_SOPORTADA = 'Operación no soportada'
export const MSG_SIN_SALIDAS = 'Ningún botón tiene salida configurada'
export const MSG_SIN_TITULAR = 'El domicilio aún no está sincronizado'
export const MSG_PERFIL_INEXISTENTE = 'El permiso configurado ya no existe en access-core'

type BotonLocal = { boton: number; rf_code: number; boton_id: string | null }
type Carga = Record<string, unknown>
type Operacion = (ctx: Contexto, tarea: Tarea) => Promise<void>

/** Ejecuta la tarea contra access-core y guarda los ids externos. Nunca lanza. */
export async function ejecutar(ctx: Contexto, tarea: Tarea): Promise<Resultado> {
  const op = OPERACIONES[`${tarea.entidad}:${tarea.operacion}`]
  if (!op) return { ok: false, error: new Error(MSG_NO_SOPORTADA) }
  try {
    await op(ctx, tarea)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

// ---------------------------------------------------------------------------
// Lecturas y escrituras locales

function revisar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const carga = (tarea: Tarea) => (tarea.carga ?? {}) as Carga

function domicilioId(tarea: Tarea): number {
  if (tarea.domicilio_id == null) throw new Error('La tarea no tiene domicilio')
  return tarea.domicilio_id
}

async function titularDe(ctx: Contexto, tarea: Tarea): Promise<string> {
  const dom = revisar(
    await ctx.admin.from('domicilios').select('titular_id').eq('id', domicilioId(tarea)).maybeSingle(),
  )
  if (!dom?.titular_id) throw new Error(MSG_SIN_TITULAR)
  return dom.titular_id
}

async function mediosPermitidos(ctx: Contexto, tarea: Tarea): Promise<string[]> {
  const dc = revisar(
    await ctx.admin.from('domicilio_concepto').select('concepto_id').eq('domicilio_id', domicilioId(tarea)).maybeSingle(),
  )
  if (!dc) return []
  const cpa = revisar(
    await ctx.admin.from('concepto_pago_acceso').select('medios').eq('concepto_pago_id', dc.concepto_id).maybeSingle(),
  )
  return cpa?.medios ?? []
}

async function salidasDeBotones(ctx: Contexto, tarea: Tarea): Promise<Map<number, { panel_id: string; salida: number }>> {
  const filas = revisar(
    await ctx.admin
      .from('fraccionamiento_botones')
      .select('boton, panel_id, salida')
      .eq('fraccionamiento_id', tarea.fraccionamiento_id),
  )
  return new Map((filas ?? []).map((f) => [f.boton, f]))
}

// ---------------------------------------------------------------------------
// Domicilio (titular `kind: 'domicilio'`)

function cuerpoTitular(tarea: Tarea) {
  const c = carga(tarea)
  return { name: String(c.name ?? ''), address: String(c.address ?? ''), notes: String(c.notes ?? '') }
}

const domicilioCrear: Operacion = async (ctx, tarea) => {
  const id = domicilioId(tarea)
  const dom = revisar(await ctx.admin.from('domicilios').select('titular_id').eq('id', id).maybeSingle())
  if (dom?.titular_id) return
  const titular = await ctx.api.crearTitular(ctx.instalacionId, { kind: 'domicilio', ...cuerpoTitular(tarea) }, tarea.id)
  // Solo si sigue sin titular: no pisa uno guardado por otra corrida (p. ej. tras cambiar la instalación).
  revisar(await ctx.admin.from('domicilios').update({ titular_id: titular.id }).eq('id', id).is('titular_id', null))
}

const domicilioActualizar: Operacion = async (ctx, tarea) => {
  const titular = await titularDe(ctx, tarea)
  await ctx.api.editarTitular(ctx.instalacionId, titular, cuerpoTitular(tarea), tarea.id)
}

/** Agrega el titular al perfil deseado y lo quita de los demás, con un PUT por perfil tocado. */
const domicilioAsignar: Operacion = async (ctx, tarea) => {
  const id = domicilioId(tarea)
  const titular = await titularDe(ctx, tarea)
  const deseado = revisar(await ctx.admin.rpc('perfil_deseado', { p_domicilio_id: id })) ?? null
  const perfiles = await ctx.api.listarPerfiles(ctx.instalacionId)
  // Error simple (no AccessCoreError): no se reintenta. Se revisa antes de tocar ningún perfil.
  if (deseado != null && !perfiles.some((p) => p.id === deseado)) throw new Error(MSG_PERFIL_INEXISTENTE)
  for (const p of perfiles) {
    const loTiene = p.holder_ids.includes(titular)
    if (p.id === deseado && !loTiene) {
      await ctx.api.asignarTitulares(ctx.instalacionId, p.id, [...p.holder_ids, titular], `${tarea.id}:${p.id}`)
    } else if (p.id !== deseado && loTiene) {
      const resto = p.holder_ids.filter((h) => h !== titular)
      await ctx.api.asignarTitulares(ctx.instalacionId, p.id, resto, `${tarea.id}:${p.id}`)
    }
  }
  revisar(await ctx.admin.from('domicilios').update({ perfil_asignado_id: deseado }).eq('id', id))
}

/** Alinea tarjetas, controles y PIN en access-core con los medios del tipo de cuota; conserva las filas locales. */
const domicilioReconciliar: Operacion = async (ctx, tarea) => {
  const id = domicilioId(tarea)
  const titular = await titularDe(ctx, tarea)
  const medios = await mediosPermitidos(ctx, tarea)

  const tarjetas = revisar(await ctx.admin.from('tarjetas_acceso').select('*').eq('domicilio_id', id)) ?? []
  for (const t of tarjetas) {
    // Sufijo por operación: crear y borrar la misma fila en reconciliaciones distintas no comparten llave.
    const clave = `${tarea.id}:tarjeta:${t.id}`
    if (!t.tarjeta_id && medios.includes('tarjeta')) {
      await crearTarjetaRemota(ctx, titular, t, `${clave}:crear`)
    } else if (t.tarjeta_id && !medios.includes('tarjeta')) {
      await ctx.api.borrarTarjeta(ctx.instalacionId, t.tarjeta_id, `${clave}:borrar`)
      revisar(await ctx.admin.from('tarjetas_acceso').update({ tarjeta_id: null }).eq('id', t.id))
    }
  }

  const controles = revisar(await ctx.admin.from('controles_acceso').select('*').eq('domicilio_id', id)) ?? []
  for (const c of controles) {
    const clave = `${tarea.id}:control:${c.id}`
    if (!c.control_id && medios.includes('control')) {
      await crearControlRemoto(ctx, tarea, titular, c, `${clave}:crear`)
    } else if (c.control_id && !medios.includes('control')) {
      await ctx.api.borrarControl(ctx.instalacionId, c.control_id, `${clave}:borrar`)
      revisar(await ctx.admin.from('controles_acceso').update({ control_id: null }).eq('id', c.id))
    }
  }

  // Fijar el mismo PIN y quitarlo son idempotentes en access-core: no hace falta leer `has_pin`.
  const pin = revisar(await ctx.admin.from('pines_acceso').select('pin').eq('domicilio_id', id).maybeSingle())
  if (pin && medios.includes('pin')) await ctx.api.fijarPin(ctx.instalacionId, titular, pin.pin)
  else if (pin && !medios.includes('pin')) await ctx.api.quitarPin(ctx.instalacionId, titular)
}

// ---------------------------------------------------------------------------
// Tarjetas

async function leerTarjeta(ctx: Contexto, tarea: Tarea) {
  return revisar(await ctx.admin.from('tarjetas_acceso').select('*').eq('id', tarea.entidad_id ?? -1).maybeSingle())
}

type FilaTarjeta = Database['public']['Tables']['tarjetas_acceso']['Row']

/**
 * Crea la tarjeta en access-core y guarda su id. Si la fila local se borró mientras tanto (el update no
 * toca filas), el `borrar` encolado no conocía el id externo: se borra la tarjeta remota aquí, con una
 * llave de idempotencia distinta (`:compensar`), para no dejarla huérfana.
 */
async function crearTarjetaRemota(ctx: Contexto, titular: string, t: FilaTarjeta, clave: string) {
  const creada = await ctx.api.crearTarjeta(
    ctx.instalacionId,
    { card_code: Number(t.numero), holder_id: titular, description: t.descripcion ?? '' },
    clave,
  )
  const filas = revisar(
    await ctx.admin.from('tarjetas_acceso').update({ tarjeta_id: creada.id }).eq('id', t.id).select('id'),
  )
  if ((filas ?? []).length === 0) await ctx.api.borrarTarjeta(ctx.instalacionId, creada.id, `${clave}:compensar`)
}

const tarjetaCrear: Operacion = async (ctx, tarea) => {
  const t = await leerTarjeta(ctx, tarea)
  if (!t || t.tarjeta_id) return // ya se borró o ya existe en access-core
  // El tipo de cuota ya no permite tarjeta: la creará `reconciliar` si se vuelve a permitir.
  if (!(await mediosPermitidos(ctx, tarea)).includes('tarjeta')) return
  await crearTarjetaRemota(ctx, await titularDe(ctx, tarea), t, tarea.id)
}

const tarjetaActualizar: Operacion = async (ctx, tarea) => {
  const t = await leerTarjeta(ctx, tarea)
  if (!t?.tarjeta_id) return // aún no existe en access-core: se manda completa al crearla
  await ctx.api.editarTarjeta(ctx.instalacionId, t.tarjeta_id, { description: t.descripcion ?? '' }, tarea.id)
}

const tarjetaBorrar: Operacion = async (ctx, tarea) => {
  const externo = carga(tarea).tarjeta_id
  if (typeof externo !== 'string' || !externo) return
  await ctx.api.borrarTarjeta(ctx.instalacionId, externo, tarea.id)
}

// ---------------------------------------------------------------------------
// Controles

type FilaControl = Database['public']['Tables']['controles_acceso']['Row']

/** Botones con salida configurada en el fraccionamiento; los demás se omiten. */
async function botonesCuerpo(ctx: Contexto, tarea: Tarea, botones: BotonLocal[]): Promise<BotonCuerpo[]> {
  const salidas = await salidasDeBotones(ctx, tarea)
  const cuerpo = botones.flatMap((b) => {
    const s = salidas.get(b.boton)
    return s ? [{ id: b.boton_id ?? null, button: b.boton, rf_code: b.rf_code, outputs: { [s.panel_id]: s.salida } }] : []
  })
  if (cuerpo.length === 0) throw new Error(MSG_SIN_SALIDAS)
  return cuerpo
}

/** Guarda el id externo y los `boton_id`; devuelve cuántas filas actualizó (0 si la fila ya no existe). */
async function guardarControl(ctx: Contexto, fila: FilaControl, botones: BotonLocal[], remoto: Control): Promise<number> {
  const ids = new Map(remoto.buttons.map((b) => [b.button, b.id]))
  const nuevos = botones.map((b) => ({ ...b, boton_id: ids.get(b.boton) ?? b.boton_id ?? null }))
  const filas = revisar(
    await ctx.admin
      .from('controles_acceso')
      .update({ control_id: remoto.id, botones: nuevos as unknown as Json })
      .eq('id', fila.id)
      .select('id'),
  )
  return (filas ?? []).length
}

async function crearControlRemoto(ctx: Contexto, tarea: Tarea, titular: string, fila: FilaControl, clave: string) {
  const botones = fila.botones as unknown as BotonLocal[]
  const remoto = await ctx.api.crearControl(
    ctx.instalacionId,
    { holder_id: titular, description: fila.descripcion ?? '', buttons: await botonesCuerpo(ctx, tarea, botones) },
    clave,
  )
  // Igual que las tarjetas: si la fila se borró mientras se creaba, se borra el control remoto.
  if ((await guardarControl(ctx, fila, botones, remoto)) === 0) {
    await ctx.api.borrarControl(ctx.instalacionId, remoto.id, `${clave}:compensar`)
  }
}

async function leerControl(ctx: Contexto, tarea: Tarea) {
  return revisar(await ctx.admin.from('controles_acceso').select('*').eq('id', tarea.entidad_id ?? -1).maybeSingle())
}

const controlCrear: Operacion = async (ctx, tarea) => {
  const c = await leerControl(ctx, tarea)
  if (!c || c.control_id) return
  if (!(await mediosPermitidos(ctx, tarea)).includes('control')) return // igual que tarjetas
  await crearControlRemoto(ctx, tarea, await titularDe(ctx, tarea), c, tarea.id)
}

const controlActualizar: Operacion = async (ctx, tarea) => {
  const c = await leerControl(ctx, tarea)
  if (!c?.control_id) return // aún no existe en access-core: se manda completo al crearlo
  const botones = c.botones as unknown as BotonLocal[]
  const remoto = await ctx.api.reemplazarControl(
    ctx.instalacionId,
    c.control_id,
    // La API exige `description` en el PUT.
    { holder_id: await titularDe(ctx, tarea), description: c.descripcion ?? '', buttons: await botonesCuerpo(ctx, tarea, botones) },
    tarea.id,
  )
  await guardarControl(ctx, c, botones, remoto)
}

const controlBorrar: Operacion = async (ctx, tarea) => {
  const externo = carga(tarea).control_id
  if (typeof externo !== 'string' || !externo) return
  await ctx.api.borrarControl(ctx.instalacionId, externo, tarea.id)
}

// ---------------------------------------------------------------------------
// PIN (por domicilio; el valor se lee de `pines_acceso`, nunca de la carga)

const pinFijar: Operacion = async (ctx, tarea) => {
  const fila = revisar(
    await ctx.admin.from('pines_acceso').select('pin').eq('domicilio_id', domicilioId(tarea)).maybeSingle(),
  )
  if (!fila) return
  await ctx.api.fijarPin(ctx.instalacionId, await titularDe(ctx, tarea), fila.pin)
}

const pinQuitar: Operacion = async (ctx, tarea) => {
  await ctx.api.quitarPin(ctx.instalacionId, await titularDe(ctx, tarea))
}

const OPERACIONES: Record<string, Operacion | undefined> = {
  'domicilio:crear': domicilioCrear,
  'domicilio:actualizar': domicilioActualizar,
  'domicilio:asignar': domicilioAsignar,
  'domicilio:reconciliar': domicilioReconciliar,
  'tarjeta:crear': tarjetaCrear,
  'tarjeta:actualizar': tarjetaActualizar,
  'tarjeta:borrar': tarjetaBorrar,
  'control:crear': controlCrear,
  'control:actualizar': controlActualizar,
  'control:borrar': controlBorrar,
  'pin:fijar': pinFijar,
  'pin:quitar': pinQuitar,
}
