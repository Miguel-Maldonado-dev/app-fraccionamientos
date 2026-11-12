'use server'

import type { ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES } from '@/lib/constants'
import { actualizarControlEn, crearControlEn, eliminarControlEn } from './mutaciones'
import type { ControlInput } from './schemas'

/** Como las tarjetas: solo el administrador escribe controles (RLS de `controles_acceso`). */
const ADMIN = [ROLES.ADMINISTRADOR]

export async function crearControl(domicilioId: number, input: ControlInput): Promise<ActionResult> {
  return runAction(ADMIN, () => crearControlEn(null, domicilioId, input))
}

export async function actualizarControl(id: number, domicilioId: number, input: ControlInput): Promise<ActionResult> {
  return runAction(ADMIN, () => actualizarControlEn(null, id, domicilioId, input))
}

export async function eliminarControl(id: number, domicilioId: number): Promise<ActionResult> {
  return runAction(ADMIN, () => eliminarControlEn(null, id, domicilioId))
}
