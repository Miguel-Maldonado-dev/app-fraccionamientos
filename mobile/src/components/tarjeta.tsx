import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useEstilos } from '../lib/apariencia'
import { espacio, radio, sombraPara, type Esquema, type Paleta } from '../lib/tema'

/** Tarjeta blanca, radio 24, sombra azulada suave, sin borde. */
export function Tarjeta({ children, style, testID }: { children?: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useEstilos(crearEstilos)
  return (
    <View testID={testID} style={[styles.tarjeta, style]}>
      {children}
    </View>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    tarjeta: { backgroundColor: colores.superficie, borderRadius: radio.xl, padding: espacio.md + 4, ...sombraPara(esquema) },
  })
