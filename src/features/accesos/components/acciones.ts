import type { ActionResult } from '@/lib/action-result'
import type { ControlInput } from '@/features/controles/schemas'
import type { TarjetaInput } from '../schemas'

/**
 * Acciones de teléfonos, tarjetas, controles y PIN que usan los componentes de accesos. Por defecto son las del
 * fraccionamiento; la consola del super admin pasa las suyas ligadas al fraccionamiento
 * (`accion.bind(null, fraccionamientoId)`), con las mismas firmas.
 */
export type AccionesAccesos = {
  crearTelefono: (domicilioId: number, valor: string) => Promise<ActionResult>
  actualizarTelefono: (id: number, domicilioId: number, valor: string) => Promise<ActionResult>
  eliminarTelefono: (id: number, domicilioId: number) => Promise<ActionResult>
  crearTarjeta: (domicilioId: number, input: TarjetaInput) => Promise<ActionResult>
  /** Solo la descripción: el número de una tarjeta no se edita. */
  actualizarTarjeta: (id: number, domicilioId: number, descripcion: string) => Promise<ActionResult>
  eliminarTarjeta: (id: number, domicilioId: number) => Promise<ActionResult>
  crearControl: (domicilioId: number, input: ControlInput) => Promise<ActionResult>
  actualizarControl: (id: number, domicilioId: number, input: ControlInput) => Promise<ActionResult>
  eliminarControl: (id: number, domicilioId: number) => Promise<ActionResult>
  /** PIN: síncronos con access-core (sin cola). */
  fijarPin: (domicilioId: number, pin: string) => Promise<ActionResult>
  generarPin: (domicilioId: number) => Promise<ActionResult<{ pin: string }>>
  quitarPin: (domicilioId: number) => Promise<ActionResult>
  /** Vuelve a `pendiente` una tarea de sincronización en error (por id de tarea). */
  reintentarTarea: (id: string) => Promise<ActionResult>
}
