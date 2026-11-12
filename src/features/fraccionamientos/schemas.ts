import { z } from 'zod'

export const SLUG_PATRON = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MSG_SLUG = 'Usa minúsculas, números y guiones'

export const fraccionamientoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  slug: z.string().trim().min(1, MSG_SLUG).max(60, 'Máximo 60 caracteres').regex(SLUG_PATRON, MSG_SLUG),
  instalacionId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.uuid('ID de instalación inválido').nullable()),
  /** Copia del nombre que da la API, solo para mostrar; el cliente la manda junto con el id. */
  instalacionNombre: z.string().nullable(),
  activo: z.boolean(),
})

export type FraccionamientoInput = z.input<typeof fraccionamientoSchema>
export type FraccionamientoDatos = z.output<typeof fraccionamientoSchema>
