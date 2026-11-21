export const MSG_CUOTAS_GENERADAS = 'Cuotas generadas correctamente.'
export const MSG_CUOTA_GENERADA = 'Cuota generada correctamente.'
export const MSG_CUOTA_DUPLICADA = 'Ya existe una cuota registrada para el año y mes seleccionados.'
export const MSG_SIN_CONCEPTO = 'El domicilio no tiene un tipo de cuota asignado.'
export const MSG_CUOTA_EDITADA = 'Cuota editada correctamente.'
export const MSG_SOLO_PENDIENTES = 'Solo se pueden editar cuotas pendientes o vencidas.'
export const MSG_CUOTA_NO_EXISTE = 'La cuota no existe.'
export const MSG_DESCUENTO_ELIMINADO = 'Descuento eliminado correctamente.'
export const MSG_RECARGO_ELIMINADO = 'Recargo eliminado correctamente.'
export const MSG_CUOTAS_NO_CANCELABLES =
  'Solo se pueden cancelar cuotas pendientes o vencidas, sin pago, de un mismo domicilio.'
export const MSG_CUOTA_NO_CANCELADA = 'La cuota no existe o no está cancelada.'
export const MSG_CUOTA_REACTIVADA = 'Cuota reactivada correctamente.'
export const msgCuotasCanceladas = (n: number) => (n === 1 ? '1 cuota cancelada' : `${n} cuotas canceladas`)
