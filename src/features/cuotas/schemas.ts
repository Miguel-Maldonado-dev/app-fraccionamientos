import { z } from 'zod'

export const periodoSchema = z.object({
  anio: z.coerce.number().int().min(2000),
  mes: z.coerce.number().int().min(1).max(12),
})

export const cancelarCuotasSchema = z.object({
  domicilioId: z.number().int().min(1),
  cuotaIds: z.array(z.number().int().min(1)).min(1, 'Selecciona al menos una cuota.'),
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo debe tener al menos 3 caracteres.')
    .max(500, 'El motivo no puede exceder 500 caracteres.'),
})
