import { z } from 'zod'

/** `rf_code` de access-core es un entero de 32 bits sin signo (igual que el `check` de la tabla). */
export const MAX_RF_CODE = 4294967295

export const botonControlSchema = z.object({
  boton: z.number('Botón no válido').int('Botón no válido').min(0, 'Botón no válido').max(3, 'Botón no válido'),
  rfCode: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, 'Solo dígitos, máximo 10')
    .refine((v) => Number(v) <= MAX_RF_CODE, 'El código excede 32 bits (máximo 4294967295)'),
})

/** Control RF: descripción opcional y de 1 a 4 botones distintos (0..3), cada uno con su código RF. */
export const controlSchema = z.object({
  descripcion: z.string().trim().max(60, 'Máximo 60 caracteres').optional(),
  botones: z
    .array(botonControlSchema)
    .min(1, 'Captura el código de al menos un botón')
    .max(4, 'Máximo 4 botones')
    .refine((bs) => new Set(bs.map((b) => b.boton)).size === bs.length, 'Cada botón solo puede usarse una vez'),
})

export type ControlInput = z.input<typeof controlSchema>

/** Botón tal como se guarda en `controles_acceso.botones` (`boton_id` = id externo en access-core). */
export type BotonGuardado = { boton: number; rf_code: number; boton_id: string | null }

/** Etiqueta visible de un botón: el 0 es "Botón 1". */
export const etiquetaBoton = (boton: number) => `Botón ${boton + 1}`
