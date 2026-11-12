'use server'

import type { ActionResult } from '@/lib/action-result'
import { runAction, runSuperAdminAction } from '@/lib/auth/run-action'
import { ROLES } from '@/lib/constants'
import { guardarReglasCobroEn } from './mutaciones'
import type { ReglasCobroInput } from './schemas'

/** Solo el administrador escribe las reglas (RLS de `reglas_cobro`); el tesorero las ve. */
export async function guardarReglasCobro(input: ReglasCobroInput): Promise<ActionResult> {
  return runAction([ROLES.ADMINISTRADOR], () => guardarReglasCobroEn(null, input))
}

/** Consola: el super admin edita las reglas de cualquier fraccionamiento. */
export async function guardarReglasCobroConsola(fraccionamientoId: number, input: ReglasCobroInput): Promise<ActionResult> {
  return runSuperAdminAction(() => guardarReglasCobroEn(fraccionamientoId, input))
}
