/**
 * Cómo se acomoda cada botón en la cuadrícula de 2 columnas: los de ancho completo ocupan la fila;
 * en cada grupo de botones de mitad (entre dos completos o al final), si quedan impares el último se estira.
 * Copia exacta de `src/features/app-botones/schemas.ts` de la web.
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
