import { z } from 'zod'

const entero = (nombre: string, min: number, max: number) =>
  z
    .number(`${nombre} no válido`)
    .int(`${nombre} debe ser un número entero`)
    .min(min, `${nombre} debe estar entre ${min} y ${max}`)
    .max(max, `${nombre} debe estar entre ${min} y ${max}`)

/** Reglas de cobro de un fraccionamiento (rangos iguales a los `check` de `reglas_cobro`). */
export const reglasCobroSchema = z.object({
  /** Nulo = sin generación automática. */
  diaGeneracion: entero('El día de generación', 1, 28).nullable(),
  /** Nulo = último día del mes. */
  diaVencimiento: entero('El día de vencimiento', 1, 31).nullable(),
  diasGracia: entero('Los días de gracia', 0, 60),
  cuotasParaMoroso: entero('Las cuotas para ser moroso', 1, 12),
  conceptoRecargoId: z.number('Recargo no válido').int('Recargo no válido').positive('Recargo no válido').nullable(),
})

export type ReglasCobro = z.infer<typeof reglasCobroSchema>
export type ReglasCobroInput = z.input<typeof reglasCobroSchema>

/** Valores por omisión (sin fila en `reglas_cobro`): el comportamiento de siempre. */
export const REGLAS_COBRO_POR_OMISION: ReglasCobro = {
  diaGeneracion: null,
  diaVencimiento: null,
  diasGracia: 0,
  cuotasParaMoroso: 1,
  conceptoRecargoId: null,
}
