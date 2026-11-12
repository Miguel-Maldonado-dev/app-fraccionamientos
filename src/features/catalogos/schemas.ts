import { z } from 'zod'
import { MEDIOS_ACCESO } from '@/lib/constants'

const IMPORTE_TEXTO = /^\d+(\.\d+)?$/
const IMPORTE_MAXIMO = 999_999.99

const importeSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const texto = String(v).trim()
    if (!IMPORTE_TEXTO.test(texto)) {
      ctx.addIssue({ code: 'custom', message: 'Ingresa un importe válido' })
      return z.NEVER
    }
    return Number(texto)
  })
  .refine((n) => n > 0, 'El importe debe ser mayor a 0')
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, 'Máximo 2 decimales')
  .refine((n) => n <= IMPORTE_MAXIMO, 'El importe máximo es 999,999.99')

export const catalogoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  importe: importeSchema,
})

// Permiso de access-core: uuid, o vacío ('' del Select "Ninguno") -> null.
const perfilIdSchema = z
  .union([z.guid('Permiso no válido'), z.literal('')])
  .nullish()
  .transform((v) => v || null)
const perfilNombreSchema = z
  .string()
  .trim()
  .max(120)
  .nullish()
  .transform((v) => v || null)

export const tipoCuotaSchema = catalogoSchema.extend({
  medios: z.array(z.enum(MEDIOS_ACCESO)),
  perfilCorrienteId: perfilIdSchema,
  perfilCorrienteNombre: perfilNombreSchema,
  perfilMorosoId: perfilIdSchema,
  perfilMorosoNombre: perfilNombreSchema,
})

export type CatalogoInput = z.input<typeof catalogoSchema>
export type TipoCuotaInput = z.input<typeof tipoCuotaSchema>
export type TipoCuotaOutput = z.output<typeof tipoCuotaSchema>
