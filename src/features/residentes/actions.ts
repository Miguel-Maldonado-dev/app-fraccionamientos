'use server'

import type { ActionResult } from '@/lib/action-result'
import { MSG_ERROR as MSG_ERROR_INESPERADO, runAction } from '@/lib/auth/run-action'
import { ROLES } from '@/lib/constants'
import { fail, ok } from '@/lib/action-result'
import { darAccesoAppEn, type ResultadoAcceso } from './acceso-app'
import { MSG_PASSWORD_CORTA, MSG_RESIDENTE_SIN_ACCESO, MSG_TELEFONO_INVALIDO } from './messages'
import { actualizarResidenteEn, crearResidenteConIdEn, crearResidenteEn, eliminarResidenteEn } from './mutaciones'
import type { ResidenteInput } from './schemas'
import { normalizarTelefono } from './telefono'
import { passwordValida } from './cuentas'

export type CrearResidenteInput = ResidenteInput & { password?: string; darAcceso?: boolean }

/**
 * Con `darAcceso`, además crea o vincula su cuenta de la app. Si la cuenta falla, el residente se
 * queda creado sin acceso y el error se informa con `MSG_RESIDENTE_SIN_ACCESO`.
 */
export async function crearResidente(
  domicilioId: number,
  input: CrearResidenteInput,
): Promise<ActionResult<ResultadoAcceso | void>> {
  const { password, darAcceso, ...residente } = input
  if (!darAcceso) {
    return runAction([ROLES.ADMINISTRADOR], () => crearResidenteEn(null, domicilioId, residente))
  }

  const telefono = normalizarTelefono(residente.telefono ?? '')
  if (!telefono) return fail(MSG_TELEFONO_INVALIDO)
  if (password && !passwordValida(password)) return fail(MSG_PASSWORD_CORTA)

  return runAction([ROLES.ADMINISTRADOR], async () => {
    const creado = await crearResidenteConIdEn(null, domicilioId, { ...residente, telefono })
    if (!creado.ok) return creado
    const acceso = await darAccesoAppEn(creado.data, { telefono, password }).catch((error: unknown) => {
      console.error('crearResidente: no se pudo dar acceso a la app', error)
      return fail(MSG_ERROR_INESPERADO)
    })
    if (!acceso.ok) return fail(`${MSG_RESIDENTE_SIN_ACCESO}: ${acceso.error}`)
    return ok(acceso.data)
  })
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
