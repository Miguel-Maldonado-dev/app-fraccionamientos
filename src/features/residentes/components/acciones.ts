import type { ActionResult } from '@/lib/action-result'
import type { ResultadoAcceso } from '../acceso-app'
import type { CrearResidenteInput } from '../actions'
import type { ResidenteInput } from '../schemas'

/**
 * Acciones de residentes que usan los componentes. Por defecto son las del fraccionamiento; la
 * consola del super admin pasa las suyas ligadas al fraccionamiento
 * (`accion.bind(null, fraccionamientoId)`), con las mismas firmas.
 */
export type AccionesResidentes = {
  crear: (domicilioId: number, input: CrearResidenteInput) => Promise<ActionResult<ResultadoAcceso | void>>
  actualizar: (id: number, domicilioId: number, input: ResidenteInput) => Promise<ActionResult>
  eliminar: (id: number, domicilioId: number) => Promise<ActionResult>
}
