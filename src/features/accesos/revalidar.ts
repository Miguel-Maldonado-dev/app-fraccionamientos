import { revalidatePath } from 'next/cache'

/**
 * Revalida el detalle del domicilio tras escribir un medio de acceso: en el fraccionamiento
 * (`fraccionamientoId` = `null`) o en la consola (el fraccionamiento y el domicilio).
 */
export function revalidar(fraccionamientoId: number | null, domicilioId: number) {
  if (fraccionamientoId === null) {
    revalidatePath(`/domicilios/${domicilioId}`)
    return
  }
  revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}`)
  revalidatePath(`/admin/fraccionamientos/${fraccionamientoId}/domicilios/${domicilioId}`)
}
