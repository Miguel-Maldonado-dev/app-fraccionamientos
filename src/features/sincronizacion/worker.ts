import 'server-only'
import * as api from '@/lib/access-core'
import { AccessCoreError, AccessCoreNoConfigurado } from '@/lib/access-core'
import { createAdminClient } from '@/lib/supabase/admin'
import { ejecutar, type Contexto } from './operaciones'
import { MAX_INTENTOS, proximoIntento } from './reintentos'
import type { Tarea } from './tipos'

/**
 * `omitidos`: fraccionamientos saltados porque otro trabajador tenía su lease (o su instalación cambió).
 * `noConfigurado`: la corrida se detuvo porque falta `ACCESS_CORE_API_KEY`.
 */
export type ResumenSincronizacion = {
  procesadas: number
  fallidas: number
  detenidoPor429: boolean
  omitidos: number
  noConfigurado?: boolean
}

type Opciones = { fraccionamientoId?: number; limite?: number; ahora?: Date }

/** Señal interna para cortar la corrida completa (429 o access-core sin configurar). */
class Detener extends Error {}

const ESPERA_429_S = 60
/** Se renueva el lease (300 s en la base) cada tantas tareas ejecutadas. */
const RENOVAR_CADA = 10
/**
 * Las tareas bloqueadas (domicilio sin `crear` en `ok` o sin titular) se saltan sin escribirse, así que
 * siguen siendo las más viejas. Se leen hasta `limite × LECTURA_POR_EJECUTADA` filas para que no llenen
 * el lote y dejen sin procesar a los demás domicilios; la lectura queda acotada aunque la cola sea enorme.
 */
const LECTURA_POR_EJECUTADA = 10

function revisar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

/**
 * Procesa la cola de `sincronizaciones_acceso` contra access-core: por fraccionamiento con instalación,
 * las tareas `pendiente` vencidas en orden de `created_at`. `procesadas` cuenta las que quedaron `ok`;
 * `fallidas`, las que fallaron (reintentables o no).
 */
export async function procesarSincronizaciones(opciones: Opciones = {}): Promise<ResumenSincronizacion> {
  const { fraccionamientoId, limite = 50, ahora = new Date() } = opciones
  const admin = createAdminClient()
  const resumen: ResumenSincronizacion = { procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 0 }

  let q = admin.from('fraccionamientos').select('id, instalacion_id')
  if (fraccionamientoId != null) q = q.eq('id', fraccionamientoId)
  const fraccionamientos = revisar(await q) ?? []

  try {
    for (const f of fraccionamientos) {
      if (!f.instalacion_id) continue
      const ctx: Contexto = { admin, instalacionId: f.instalacion_id, api }
      await conLease(ctx, f.id, resumen, async (renovar) => {
        // La instalación pudo cambiar entre la lectura y el lease: con el lease tomado ya no puede.
        const actual = revisar(
          await admin.from('fraccionamientos').select('instalacion_id').eq('id', f.id).maybeSingle(),
        )
        if (actual?.instalacion_id !== f.instalacion_id) {
          resumen.omitidos += 1
          return
        }
        await procesarFraccionamiento(ctx, f.id, limite, ahora, resumen, renovar)
      })
    }
  } catch (e) {
    if (!(e instanceof Detener)) throw e
  }
  return resumen
}

/**
 * Toma el lease del fraccionamiento con un token propio (si otro trabajador lo tiene, lo omite), ejecuta
 * `fn` y siempre lo libera. `renovar()` extiende el lease y devuelve si se sigue teniendo.
 */
async function conLease(
  ctx: Contexto,
  fraccionamientoId: number,
  resumen: ResumenSincronizacion,
  fn: (renovar: () => Promise<boolean>) => Promise<void>,
) {
  const token = crypto.randomUUID()
  const adquirir = async () =>
    revisar(
      await ctx.admin.rpc('adquirir_sincronizacion', { p_fraccionamiento_id: fraccionamientoId, p_token: token }),
    ) === true
  if (!(await adquirir())) {
    resumen.omitidos += 1
    return
  }
  try {
    await fn(adquirir)
  } finally {
    revisar(await ctx.admin.rpc('liberar_sincronizacion', { p_fraccionamiento_id: fraccionamientoId, p_token: token }))
  }
}

async function procesarFraccionamiento(
  ctx: Contexto,
  fraccionamientoId: number,
  limite: number,
  ahora: Date,
  resumen: ResumenSincronizacion,
  renovar: () => Promise<boolean>,
) {
  const { admin } = ctx

  const tareas: Tarea[] =
    revisar(
      await admin
        .from('sincronizaciones_acceso')
        .select('*')
        .eq('fraccionamiento_id', fraccionamientoId)
        .eq('estado', 'pendiente')
        .lte('proximo_intento_at', ahora.toISOString())
        .order('created_at', { ascending: true })
        .limit(limite * LECTURA_POR_EJECUTADA),
    ) ?? []
  if (tareas.length === 0) return

  const { conTitular, esperandoCrear } = await estadoDomicilios(ctx, tareas)

  let ejecutadas = 0
  for (const tarea of tareas) {
    const d = tarea.domicilio_id
    const esCrearDomicilio = tarea.entidad === 'domicilio' && tarea.operacion === 'crear'
    // Todo lo de un domicilio espera a su `domicilio crear` y a tener titular en access-core.
    if (d != null && !esCrearDomicilio && (esperandoCrear.has(d) || !conTitular.has(d))) continue

    if (ejecutadas >= limite) return
    if (ejecutadas > 0 && ejecutadas % RENOVAR_CADA === 0 && !(await renovar())) return // perdió el lease
    ejecutadas += 1
    const r = await ejecutar(ctx, tarea)
    if (r.ok) {
      await actualizar(ctx, tarea, { estado: 'ok', updated_at: ahora.toISOString() })
      resumen.procesadas += 1
      if (esCrearDomicilio && d != null) {
        conTitular.add(d)
        esperandoCrear.delete(d)
      }
      continue
    }

    const { error } = r
    if (error instanceof AccessCoreNoConfigurado) {
      console.error(error.message)
      resumen.noConfigurado = true
      throw new Detener()
    }
    if (error instanceof AccessCoreError && error.status === 429) {
      const espera = (error.retryAfter ?? ESPERA_429_S) * 1000
      await actualizar(ctx, tarea, {
        proximo_intento_at: new Date(ahora.getTime() + espera).toISOString(),
        updated_at: ahora.toISOString(),
      })
      resumen.detenidoPor429 = true
      throw new Detener()
    }

    const intentos = tarea.intentos + 1
    const reintentable = error instanceof AccessCoreError && error.reintentable && intentos < MAX_INTENTOS
    await actualizar(ctx, tarea, {
      intentos,
      ultimo_error: error.message,
      estado: reintentable ? 'pendiente' : 'error',
      // La escalera cuenta los fallos previos: el primero espera ESCALERA_MS[0].
      ...(reintentable ? { proximo_intento_at: proximoIntento(tarea.intentos, ahora).toISOString() } : {}),
      updated_at: ahora.toISOString(),
    })
    resumen.fallidas += 1
  }
}

/** Domicilios con `titular_id` y domicilios cuyo `domicilio crear` aún no está `ok`. */
async function estadoDomicilios(ctx: Contexto, tareas: Tarea[]) {
  const ids = [...new Set(tareas.map((t) => t.domicilio_id).filter((id): id is number => id != null))]
  const conTitular = new Set<number>()
  const esperandoCrear = new Set<number>()
  if (ids.length === 0) return { conTitular, esperandoCrear }

  const doms = revisar(await ctx.admin.from('domicilios').select('id, titular_id').in('id', ids)) ?? []
  for (const d of doms) if (d.titular_id) conTitular.add(d.id)

  const crear =
    revisar(
      await ctx.admin
        .from('sincronizaciones_acceso')
        .select('domicilio_id, estado')
        .eq('entidad', 'domicilio')
        .eq('operacion', 'crear')
        .in('domicilio_id', ids),
    ) ?? []
  for (const c of crear) if (c.estado !== 'ok' && c.domicilio_id != null) esperandoCrear.add(c.domicilio_id)
  return { conTitular, esperandoCrear }
}

async function actualizar(ctx: Contexto, tarea: Tarea, valores: Partial<Tarea>) {
  revisar(await ctx.admin.from('sincronizaciones_acceso').update(valores).eq('id', tarea.id))
}
