import { z } from 'zod'

/** Foto JSON del recibo de un pago (versión 1). Ver spec 2026-11-10-recibos-design §2. */
export const reciboDatosSchema = z.object({
  v: z.literal(1),
  fraccionamiento: z.string(),
  direccion: z.string(),
  residente: z.string(),
  concepto: z.string(),
  periodo: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  fechaPago: z.string(),
  subtotal: z.number(),
  recargo: z.number().optional(),
  descuento: z.number().optional(),
  total: z.number(),
})

export type ReciboDatos = z.infer<typeof reciboDatosSchema>

/** Valida el JSON guardado; devuelve null si está corrupto o es de otra versión. */
export function parseRecibo(value: unknown): ReciboDatos | null {
  const r = reciboDatosSchema.safeParse(value)
  return r.success ? r.data : null
}
