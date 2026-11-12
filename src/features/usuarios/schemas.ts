import { z } from 'zod'
import { toTitleCase } from '@/lib/text'
import { ROLES_FRACCIONAMIENTO } from '@/lib/constants'

const rol = z.enum(ROLES_FRACCIONAMIENTO, { error: 'Selecciona un rol' })

const userName = z.string().trim().min(1, 'El nombre es obligatorio').transform(toTitleCase)

export const nuevoUsuarioSchema = z.object({
  userName,
  email: z.string().trim().toLowerCase().pipe(z.email('Email inválido')),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol,
})

export const editarUsuarioSchema = z.object({
  userName,
  rol,
})

export type NuevoUsuarioInput = z.input<typeof nuevoUsuarioSchema>
export type EditarUsuarioInput = z.input<typeof editarUsuarioSchema>
