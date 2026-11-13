/** Dominio de los correos sintéticos de las cuentas de residente (nunca reciben correo). */
export const DOMINIO_CORREO_SINTETICO = 'auth.internal'

/**
 * Normaliza un teléfono mexicano a 10 dígitos: quita espacios, guiones, paréntesis y la lada de
 * país (+52 o 521). Devuelve `null` si no quedan exactamente 10 dígitos.
 */
export function normalizarTelefono(valor: string): string | null {
  let digitos = valor.replace(/\D/g, '')
  if (digitos.length === 13 && digitos.startsWith('521')) digitos = digitos.slice(3)
  else if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2)
  return /^\d{10}$/.test(digitos) ? digitos : null
}

export function correoSintetico(telefono: string): string {
  return `${telefono}@${DOMINIO_CORREO_SINTETICO}`
}
