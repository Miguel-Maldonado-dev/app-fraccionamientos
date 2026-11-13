'use server'

import type { ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES, ROLES_GESTION } from '@/lib/constants'
import {
  darAccesoAppEn,
  desligarDispositivoEn,
  quitarAccesoAppEn,
  restablecerPasswordResidenteEn,
  type DarAccesoInput,
  type ResultadoAcceso,
} from './acceso-app'

export async function darAccesoApp(
  residenteId: number,
  input: DarAccesoInput,
): Promise<ActionResult<ResultadoAcceso>> {
  return runAction(ROLES_GESTION, () => darAccesoAppEn(residenteId, input))
}

export async function quitarAccesoApp(residenteId: number): Promise<ActionResult> {
  return runAction(ROLES_GESTION, () => quitarAccesoAppEn(residenteId))
}

export async function restablecerPasswordResidente(residenteId: number, password: string): Promise<ActionResult> {
  return runAction(ROLES_GESTION, () => restablecerPasswordResidenteEn(residenteId, password))
}

export async function desligarDispositivo(residenteId: number): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], () => desligarDispositivoEn(residenteId))
}
