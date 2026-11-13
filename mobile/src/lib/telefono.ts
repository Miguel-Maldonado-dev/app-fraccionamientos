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

/** `3311112222` ⇒ `33 1111 2222` (otros formatos se muestran tal cual). */
export function formatoTelefono(tel: string): string {
  const d = tel.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : tel
}
