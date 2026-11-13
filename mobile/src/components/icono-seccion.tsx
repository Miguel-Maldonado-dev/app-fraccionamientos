import type { LucideIcon } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { useEstilos, useTema } from '../lib/apariencia'
import { radio, type Esquema, type Paleta } from '../lib/tema'

/** Ícono de línea azul dentro de un cuadro redondeado #EAF3FD. */
export function IconoSeccion({ icono: Icono, tamano = 48 }: { icono: LucideIcon; tamano?: number }) {
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  return (
    <View style={[styles.cuadro, { width: tamano, height: tamano }]}>
      <Icono color={colores.primario} size={Math.round(tamano / 2)} strokeWidth={1.8} />
    </View>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    cuadro: { backgroundColor: colores.azulSuave, borderRadius: radio.md + 2, alignItems: 'center', justifyContent: 'center' },
  })
