import { randomUUID } from 'expo-crypto'
import { almacen } from './almacen'

const CLAVE = 'weadmi.device_id'
let enMemoria: Promise<string> | null = null

/** UUID v4 generado una vez por instalación y guardado en secure store. */
export function obtenerDeviceId(): Promise<string> {
  if (!enMemoria) {
    enMemoria = (async () => {
      const guardado = await almacen.getItem(CLAVE)
      if (guardado) return guardado
      const nuevo = randomUUID()
      await almacen.setItem(CLAVE, nuevo)
      return nuevo
    })().catch((e) => {
      enMemoria = null
      throw e
    })
  }
  return enMemoria
}

/** Solo para pruebas. */
export function _reiniciarDeviceId() {
  enMemoria = null
}
