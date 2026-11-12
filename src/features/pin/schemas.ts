import { z } from 'zod'
import { MSG_PIN_INVALIDO } from './messages'

/** Igual que el `check` de `pines_acceso` y lo que acepta access-core. */
export const pinSchema = z.string().trim().regex(/^\d{4,6}$/, MSG_PIN_INVALIDO)
