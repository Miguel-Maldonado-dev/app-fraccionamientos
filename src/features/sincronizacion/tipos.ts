import type { Tables } from '@/lib/supabase/types'

export type Entidad = 'domicilio' | 'tarjeta' | 'control' | 'pin'
export type Operacion = 'crear' | 'actualizar' | 'borrar' | 'asignar' | 'reconciliar' | 'fijar' | 'quitar'
export type EstadoSync = 'pendiente' | 'ok' | 'error'

export type TareaNueva = {
  fraccionamientoId: number
  domicilioId: number | null
  entidad: Entidad
  entidadId: number | null
  operacion: Operacion
  carga?: Record<string, unknown>
}

export type Tarea = Tables<'sincronizaciones_acceso'>
