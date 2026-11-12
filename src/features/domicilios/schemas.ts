import { z } from 'zod'
import { isoDateSchema } from '@/lib/zod'

export const domicilioSchema = z.object({
  direccion: z
    .string()
    .trim()
    .min(1, 'La dirección es obligatoria')
    .transform((s) => s.toUpperCase()),
  fechaAlta: isoDateSchema,
  conceptoId: z.coerce.number().int().positive().optional(),
  observaciones: z.string().trim().optional(),
})

export type DomicilioInput = z.input<typeof domicilioSchema>

/** Datos editables desde la consola del super admin: el tipo de cuota solo se elige al crear. */
export const domicilioDatosSchema = domicilioSchema.omit({ conceptoId: true })

export type DomicilioDatosInput = z.input<typeof domicilioDatosSchema>
