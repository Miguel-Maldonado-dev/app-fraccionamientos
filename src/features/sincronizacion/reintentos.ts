/** Espera tras el 1.º, 2.º, 3.º y 4.º fallo; después, cada `ESPERA_FINAL_MS`. */
export const ESCALERA_MS = [60_000, 300_000, 900_000, 3_600_000]
export const ESPERA_FINAL_MS = 21_600_000
/** Al llegar a este número de intentos la tarea pasa a `error`. */
export const MAX_INTENTOS = 20

/** Cuándo reintentar una tarea que ya llevaba `intentos` fallidos antes del fallo actual. */
export function proximoIntento(intentos: number, ahora: Date): Date {
  const espera = ESCALERA_MS[intentos] ?? ESPERA_FINAL_MS
  return new Date(ahora.getTime() + espera)
}
