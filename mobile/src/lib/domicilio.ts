import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { api, apiBinario } from './api'
import type { ResidenteApp } from './inicio'
import { supabase } from './supabase'

export type Cuota = {
  id: number
  periodo: string | null
  concepto: string | null
  importe_cuota: number | null
  fecha_vencimiento: string | null
  estatus_calculado: string | null
}
export type Pago = {
  id: number
  fecha_pago: string | null
  concepto: string | null
  importe: number | null
  metodo_pago: string | null
  referencia: string | null
  tiene_recibo: boolean | null
}
export type Tarjeta = { id: number; numero: string; descripcion: string | null }
export type Control = { id: number; control_id: string | null; descripcion: string | null }
export type TelefonoAcceso = { id: number; telefono: string }
export type Accesos = { tarjetas: Tarjeta[]; controles: Control[]; pin: string | null; telefonos: TelefonoAcceso[] }

const CAMPOS_PAGO = 'id, fecha_pago, concepto, importe, metodo_pago, referencia, tiene_recibo'
export const MENSAJE_CARGA = 'No se pudo cargar la información, intenta de nuevo'

function filas<T>({ data, error }: { data: unknown; error: unknown }): T[] {
  if (error) throw new Error(MENSAJE_CARGA)
  return (data ?? []) as T[]
}

/** Cuotas del domicilio (RLS limita a los domicilios del residente); la app no calcula estatus. */
export async function cargarCuotas(domicilioId: number): Promise<Cuota[]> {
  return filas<Cuota>(
    await supabase
      .from('cuotas_info')
      .select('id, periodo, concepto, importe_cuota, fecha_vencimiento, estatus_calculado')
      .eq('domicilio_id', domicilioId)
      .order('fecha_vencimiento', { ascending: false }),
  )
}

export async function cargarPagos(domicilioId: number): Promise<Pago[]> {
  return filas<Pago>(
    await supabase
      .from('pagos_info')
      .select(CAMPOS_PAGO)
      .eq('domicilio_id', domicilioId)
      .order('fecha_pago', { ascending: false }),
  )
}

export async function cargarPago(id: number): Promise<Pago | null> {
  return filas<Pago>(await supabase.from('pagos_info').select(CAMPOS_PAGO).eq('id', id))[0] ?? null
}

export async function cargarAccesos(domicilioId: number): Promise<Accesos> {
  const [tarjetas, controles, pines, telefonos] = await Promise.all([
    supabase.from('tarjetas_acceso').select('id, numero, descripcion').eq('domicilio_id', domicilioId).order('id'),
    supabase.from('controles_acceso').select('id, control_id, descripcion').eq('domicilio_id', domicilioId).order('id'),
    supabase.from('pines_acceso').select('pin').eq('domicilio_id', domicilioId),
    supabase.from('telefonos_acceso').select('id, telefono').eq('domicilio_id', domicilioId).order('id'),
  ])
  return {
    tarjetas: filas<Tarjeta>(tarjetas),
    controles: filas<Control>(controles),
    pin: filas<{ pin: string }>(pines)[0]?.pin ?? null,
    telefonos: filas<TelefonoAcceso>(telefonos),
  }
}

export const cargarResidentes = (id: number) => api<ResidenteApp[]>(`/api/app/domicilios/${id}/residentes`)

export const MENSAJE_CUENTA_CREADA = 'Residente agregado'
export const MENSAJE_CUENTA_VINCULADA = 'Se vinculó la cuenta existente'

export type NuevoResidente = { nombre: string; telefono: string; password?: string }
export const agregarResidente = (domicilioId: number, datos: NuevoResidente) =>
  api<{ id: number; cuentaCreada: boolean }>(`/api/app/domicilios/${domicilioId}/residentes`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
export const quitarResidente = (domicilioId: number, residenteId: number) =>
  api<void>(`/api/app/domicilios/${domicilioId}/residentes/${residenteId}`, { method: 'DELETE' })

/** Descarga el PDF del recibo (con los headers de la app) a un archivo temporal y abre el menú de compartir. */
export async function compartirRecibo(pagoId: number): Promise<void> {
  const pdf = await apiBinario(`/api/app/pagos/${pagoId}/recibo`)
  const archivo = new File(Paths.cache, `recibo-${pagoId}.pdf`)
  await archivo.write(new Uint8Array(pdf))
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Recibo' })
}

export function moneda(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `$${Number(n)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** `2026-03-05` ⇒ `5 mar 2026` (sin depender de la zona horaria). */
export function fecha(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return '—'
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`
}
