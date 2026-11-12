import type { MedioAcceso } from '@/lib/constants'

export type RegistrosPorMedio = { tarjeta: number; control: number }
export type RegistrosOcultos = { tarjetas: number; controles: number }

/**
 * Registros que dejan de verse (y se dan de baja en access-core) al pasar de `mediosActuales` a
 * `mediosNuevos`. Los de medios que ya estaban ocultos no cuentan. Se calcula en el cliente con los
 * conteos que ya trae la página: no hace falta otra consulta.
 */
export function contarRegistrosQueSeOcultan(
  registros: RegistrosPorMedio,
  mediosActuales: readonly MedioAcceso[],
  mediosNuevos: readonly MedioAcceso[],
): RegistrosOcultos {
  const seQuita = (m: MedioAcceso) => mediosActuales.includes(m) && !mediosNuevos.includes(m)
  return {
    tarjetas: seQuita('tarjeta') ? registros.tarjeta : 0,
    controles: seQuita('control') ? registros.control : 0,
  }
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** "Se ocultarán 2 tarjetas y 1 control y se darán de baja en access-core"; `null` si no se oculta nada. */
export function avisoMediosOcultos({ tarjetas, controles }: RegistrosOcultos): string | null {
  const total = tarjetas + controles
  if (total === 0) return null
  const partes = [
    tarjetas > 0 ? plural(tarjetas, 'tarjeta', 'tarjetas') : null,
    controles > 0 ? plural(controles, 'control', 'controles') : null,
  ].filter(Boolean)
  return total === 1
    ? `Se ocultará ${partes[0]} y se dará de baja en access-core`
    : `Se ocultarán ${partes.join(' y ')} y se darán de baja en access-core`
}
