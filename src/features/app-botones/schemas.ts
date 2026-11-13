import { z } from 'zod'

export const ICONOS = ['puerta', 'pluma', 'peatonal', 'vehiculo', 'alberca', 'gimnasio', 'salon', 'otro'] as const
export type Icono = (typeof ICONOS)[number]

export const ESTILOS = ['azul', 'azul_claro', 'navy', 'turquesa'] as const
export type Estilo = (typeof ESTILOS)[number]

export const MAX_BOTONES = 8

export const botonSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre').max(30, 'Máximo 30 caracteres'),
  icono: z.enum(ICONOS),
  estilo: z.enum(ESTILOS).default('azul_claro'),
  anchoCompleto: z.boolean(),
  salidaId: z.uuid().nullable(),
})

export type BotonInput = z.input<typeof botonSchema>

/** Botón de la app tal como lo pinta el constructor. */
export type BotonApp = {
  id: number
  orden: number
  nombre: string
  icono: Icono
  estilo: Estilo
  ancho_completo: boolean
  salida_id: string | null
  salida_nombre: string | null
}

/** Salida de la instalación elegible para un botón. */
export type SalidaApp = { id: string; alias: string }

/**
 * Cómo se acomoda cada botón en la cuadrícula de 2 columnas: los de ancho completo ocupan la fila;
 * en cada grupo de botones de mitad (entre dos completos o al final), si quedan impares el último se estira.
 */
export function distribucion(botones: { ancho_completo: boolean }[]): ('mitad' | 'completo')[] {
  const res: ('mitad' | 'completo')[] = botones.map((b) => (b.ancho_completo ? 'completo' : 'mitad'))
  let inicio = 0
  for (let i = 0; i <= botones.length; i++) {
    if (i === botones.length || botones[i].ancho_completo) {
      const n = i - inicio
      if (n % 2 === 1) res[i - 1] = 'completo'
      inicio = i + 1
    }
  }
  return res
}
