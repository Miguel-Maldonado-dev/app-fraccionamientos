'use server'

import type { ActionResult } from '@/lib/action-result'
import { runAction } from '@/lib/auth/run-action'
import { ROLES_GESTION } from '@/lib/constants'
import { fijarPinEn, generarPinEn, quitarPinEn } from './mutaciones'

/** Administrador y tesorero (RLS de `pines_acceso`); comité y vigilancia no gestionan ni ven el PIN. */
export async function fijarPinDomicilio(domicilioId: number, pin: string): Promise<ActionResult> {
  return runAction(ROLES_GESTION, () => fijarPinEn(null, domicilioId, pin))
}

export async function generarPinDomicilio(domicilioId: number): Promise<ActionResult<{ pin: string }>> {
  return runAction(ROLES_GESTION, () => generarPinEn(null, domicilioId))
}

export async function quitarPinDomicilio(domicilioId: number): Promise<ActionResult> {
  return runAction(ROLES_GESTION, () => quitarPinEn(null, domicilioId))
}
