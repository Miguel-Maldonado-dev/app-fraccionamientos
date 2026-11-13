export const MSG_RESIDENTE_AGREGADO = 'Residente agregado correctamente.'
export const MSG_RESIDENTE_ACTUALIZADO = 'Residente actualizado correctamente.'
export const MSG_RESIDENTE_ELIMINADO = 'Residente eliminado correctamente.'
export const MSG_RESIDENTE_NO_ENCONTRADO = 'El residente ya no existe. Recarga la página.'
export const MSG_TELEFONO_INVALIDO = 'El teléfono debe tener 10 dígitos'
export const MSG_PASSWORD_CORTA = 'La contraseña debe tener al menos 8 caracteres'
export const MSG_PASSWORD_REQUERIDA = 'El teléfono no tiene cuenta: escribe una contraseña para crearla'
export const MSG_TELEFONO_YA_EN_DOMICILIO = 'Ese teléfono ya tiene acceso en este domicilio'
export const MSG_ERROR_CUENTA = 'No fue posible crear o actualizar la cuenta de la app. Intenta de nuevo.'
export const MSG_RESIDENTE_SIN_ACCESO = 'El residente se agregó, pero no fue posible darle acceso a la app'
export const MSG_SIN_ACCESO_APP = 'El residente no tiene acceso a la app'
export const msgMaximoResidentesApp = (max: number) =>
  `Este domicilio ya tiene el máximo de ${max} residentes con acceso a la app`
export const MSG_ACCESO_APP_DADO = 'Acceso a la app activado correctamente.'
export const MSG_CUENTA_VINCULADA = 'Se vinculó la cuenta existente'
export const MSG_PASSWORD_RESTABLECIDA = 'Contraseña restablecida correctamente.'
export const MSG_DISPOSITIVO_DESLIGADO = 'Dispositivo desligado'
export const MSG_ACCESO_APP_QUITADO = 'Acceso a la app retirado correctamente.'
export const MSG_CUENTA_EN_OTRO_FRACCIONAMIENTO =
  'Esta cuenta también se usa en otro fraccionamiento; el residente debe cambiar su contraseña desde la app.'
export const MSG_TELEFONO_CON_ACCESO_APP =
  'Para cambiar el teléfono de un residente con acceso a la app, quita el acceso y vuelve a dárselo.'
