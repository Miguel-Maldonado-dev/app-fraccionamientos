import { z } from 'zod'
import { isoDateSchema } from '@/lib/zod'

export const pagosUsuarioFiltroSchema = z
  // z.guid(): acepta cualquier id 8-4-4-4-12 de auth.users; z.uuid() exige versión RFC y rechaza ids
  // válidos de Postgres como los del demo (00000000-…-0000000000d1), y el reporte no consultaba.
  .object({ usuario: z.guid(), inicio: isoDateSchema, fin: isoDateSchema })
  .refine((f) => f.inicio <= f.fin, {
    message: 'La fecha fin debe ser posterior a la fecha inicio',
    path: ['fin'],
  })
