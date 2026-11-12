'use server'

import type { ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES } from '@/lib/constants'
import { actualizarResidenteEn, crearResidenteEn, eliminarResidenteEn } from './mutaciones'
import type { ResidenteInput } from './schemas'

export async function crearResidente(domicilioId: number, input: ResidenteInput): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], () => crearResidenteEn(null, domicilioId, input))
}

export async function actualizarResidente(
  id: number,
  domicilioId: number,
  input: ResidenteInput,
): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], () => actualizarResidenteEn(null, id, domicilioId, input))
}

export async function eliminarResidente(id: number, domicilioId: number): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], () => eliminarResidenteEn(null, id, domicilioId))
}
