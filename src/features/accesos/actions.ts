'use server'

import type { ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES } from '@/lib/constants'
import {
  actualizarAccesoEn,
  actualizarTarjetaEn,
  crearAccesoEn,
  crearTarjetaEn,
  eliminarAccesoEn,
  eliminarTarjetaEn,
  TELEFONO,
} from './mutaciones'
import type { TarjetaInput } from './schemas'

const ADMIN = [ROLES.ADMINISTRADOR]

export async function crearTelefono(domicilioId: number, valor: string): Promise<ActionResult> {
  return runAction(ADMIN, () => crearAccesoEn(TELEFONO, null, domicilioId, valor))
}

export async function actualizarTelefono(id: number, domicilioId: number, valor: string): Promise<ActionResult> {
  return runAction(ADMIN, () => actualizarAccesoEn(TELEFONO, null, id, domicilioId, valor))
}

export async function eliminarTelefono(id: number, domicilioId: number): Promise<ActionResult> {
  return runAction(ADMIN, () => eliminarAccesoEn(TELEFONO, null, id, domicilioId))
}

export async function crearTarjeta(domicilioId: number, input: TarjetaInput): Promise<ActionResult> {
  return runAction(ADMIN, () => crearTarjetaEn(null, domicilioId, input))
}

/** Solo la descripción: el número de una tarjeta no se edita. */
export async function actualizarTarjeta(id: number, domicilioId: number, descripcion: string): Promise<ActionResult> {
  return runAction(ADMIN, () => actualizarTarjetaEn(null, id, domicilioId, descripcion))
}

export async function eliminarTarjeta(id: number, domicilioId: number): Promise<ActionResult> {
  return runAction(ADMIN, () => eliminarTarjetaEn(null, id, domicilioId))
}
