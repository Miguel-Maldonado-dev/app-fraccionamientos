import { z } from 'zod'

export const numeroSchema = z.object({ valor: z.string().regex(/^\d{1,10}$/, 'Solo dígitos, máximo 10') })

export type NumeroInput = z.input<typeof numeroSchema>

/** `card_code` de access-core es un entero de 32 bits sin signo (igual que el `check` de la tabla). */
export const MAX_NUMERO_TARJETA = 4294967295

export const descripcionTarjetaSchema = z.string().trim().max(60, 'Máximo 60 caracteres').optional()

/** Al crear se captura el número; después solo se edita la descripción (la API no cambia `card_code`). */
export const tarjetaSchema = z.object({
  numero: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, 'Solo dígitos, máximo 10')
    .refine((v) => Number(v) <= MAX_NUMERO_TARJETA, 'El número excede 32 bits (máximo 4294967295)'),
  descripcion: descripcionTarjetaSchema,
})

export type TarjetaInput = z.input<typeof tarjetaSchema>
