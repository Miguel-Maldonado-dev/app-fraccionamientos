'use server'

import { fail, type ActionResult } from '@/lib/action-result'
import { runSuperAdminAction } from '@/lib/auth/run-action'
import {
  actualizarAccesoEn,
  actualizarTarjetaEn,
  crearAccesoEn,
  crearTarjetaEn,
  eliminarAccesoEn,
  eliminarTarjetaEn,
  TELEFONO,
} from '@/features/accesos/mutaciones'
import type { TarjetaInput } from '@/features/accesos/schemas'
import { actualizarControlEn, crearControlEn, eliminarControlEn } from '@/features/controles/mutaciones'
import type { ControlInput } from '@/features/controles/schemas'
import { fijarPinEn, generarPinEn, quitarPinEn } from '@/features/pin/mutaciones'
import { actualizarDomicilioEn, crearDomicilioEn } from '@/features/domicilios/mutaciones'
import { domicilioDatosSchema, type DomicilioDatosInput, type DomicilioInput } from '@/features/domicilios/schemas'
import { actualizarResidenteEn, crearResidenteEn, eliminarResidenteEn } from '@/features/residentes/mutaciones'
import type { ResidenteInput } from '@/features/residentes/schemas'

/*
 * Operación de domicilios, residentes y medios de acceso de cualquier fraccionamiento desde la
 * consola del super admin. Cada acción recibe el fraccionamiento explícito: filtra por él y lo
 * incluye al insertar. Revalidan `/admin/fraccionamientos/<fid>` y el detalle del domicilio.
 */

export async function crearDomicilioEnFraccionamiento(
  fraccionamientoId: number,
  input: DomicilioInput,
): Promise<ActionResult<{ id: number }>> {
  return runSuperAdminAction((admin) => crearDomicilioEn(fraccionamientoId, admin.id, input))
}

/** Solo dirección, fecha de alta y observaciones: el tipo de cuota no se cambia desde la consola. */
export async function actualizarDomicilioEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  input: DomicilioDatosInput,
): Promise<ActionResult> {
  return runSuperAdminAction(async () => {
    // Se descarta cualquier `conceptoId` que llegue del cliente antes de reutilizar la lógica común.
    const parsed = domicilioDatosSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0].message)
    const { direccion, fechaAlta, observaciones } = parsed.data
    return actualizarDomicilioEn(fraccionamientoId, id, { direccion, fechaAlta, observaciones })
  })
}

export async function crearResidenteEnFraccionamiento(
  fraccionamientoId: number,
  domicilioId: number,
  input: ResidenteInput,
): Promise<ActionResult> {
  return runSuperAdminAction(() => crearResidenteEn(fraccionamientoId, domicilioId, input))
}

export async function actualizarResidenteEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
  input: ResidenteInput,
): Promise<ActionResult> {
  return runSuperAdminAction(() => actualizarResidenteEn(fraccionamientoId, id, domicilioId, input))
}

export async function eliminarResidenteEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  return runSuperAdminAction(() => eliminarResidenteEn(fraccionamientoId, id, domicilioId))
}

export async function crearTelefonoEnFraccionamiento(
  fraccionamientoId: number,
  domicilioId: number,
  valor: string,
): Promise<ActionResult> {
  return runSuperAdminAction(() => crearAccesoEn(TELEFONO, fraccionamientoId, domicilioId, valor))
}

export async function actualizarTelefonoEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
  valor: string,
): Promise<ActionResult> {
  return runSuperAdminAction(() => actualizarAccesoEn(TELEFONO, fraccionamientoId, id, domicilioId, valor))
}

export async function eliminarTelefonoEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  return runSuperAdminAction(() => eliminarAccesoEn(TELEFONO, fraccionamientoId, id, domicilioId))
}

export async function crearTarjetaEnFraccionamiento(
  fraccionamientoId: number,
  domicilioId: number,
  input: TarjetaInput,
): Promise<ActionResult> {
  return runSuperAdminAction(() => crearTarjetaEn(fraccionamientoId, domicilioId, input))
}

export async function actualizarTarjetaEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
  descripcion: string,
): Promise<ActionResult> {
  return runSuperAdminAction(() => actualizarTarjetaEn(fraccionamientoId, id, domicilioId, descripcion))
}

export async function eliminarTarjetaEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  return runSuperAdminAction(() => eliminarTarjetaEn(fraccionamientoId, id, domicilioId))
}

export async function crearControlEnFraccionamiento(
  fraccionamientoId: number,
  domicilioId: number,
  input: ControlInput,
): Promise<ActionResult> {
  return runSuperAdminAction(() => crearControlEn(fraccionamientoId, domicilioId, input))
}

export async function actualizarControlEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
  input: ControlInput,
): Promise<ActionResult> {
  return runSuperAdminAction(() => actualizarControlEn(fraccionamientoId, id, domicilioId, input))
}

export async function eliminarControlEnFraccionamiento(
  fraccionamientoId: number,
  id: number,
  domicilioId: number,
): Promise<ActionResult> {
  return runSuperAdminAction(() => eliminarControlEn(fraccionamientoId, id, domicilioId))
}

/** PIN: síncronos con access-core (sin cola); el domicilio debe ser de `fraccionamientoId`. */
export async function fijarPinDomicilioEnFraccionamiento(
  fraccionamientoId: number,
  domicilioId: number,
  pin: string,
): Promise<ActionResult> {
  return runSuperAdminAction(() => fijarPinEn(fraccionamientoId, domicilioId, pin))
}

export async function generarPinDomicilioEnFraccionamiento(
  fraccionamientoId: number,
  domicilioId: number,
): Promise<ActionResult<{ pin: string }>> {
  return runSuperAdminAction(() => generarPinEn(fraccionamientoId, domicilioId))
}

export async function quitarPinDomicilioEnFraccionamiento(
  fraccionamientoId: number,
  domicilioId: number,
): Promise<ActionResult> {
  return runSuperAdminAction(() => quitarPinEn(fraccionamientoId, domicilioId))
}
