import { z } from 'zod'
import { isoDateSchema } from '@/lib/zod'

export const pagosUsuarioFiltroSchema = z
  .object({ usuario: z.uuid(), inicio: isoDateSchema, fin: isoDateSchema })
  .refine((f) => f.inicio <= f.fin, {
    message: 'La fecha fin debe ser posterior a la fecha inicio',
    path: ['fin'],
  })
