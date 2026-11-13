import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { useApariencia, useTema } from '../lib/apariencia'
import { opacidadOndas } from '../lib/tema'

/** Fondo #F5F8FC con ondas suaves arriba a la derecha y abajo a la izquierda. Va detrás del contenido. */
export function FondoOndas() {
  const colores = useTema()
  const { esquema } = useApariencia()
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colores.fondo }]} pointerEvents="none" testID="fondo-ondas">
      <Svg opacity={opacidadOndas(esquema)} width="100%" height="100%" viewBox="0 0 400 860" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="ondaArriba" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D6F4F8" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#BFDDFB" stopOpacity="0.9" />
          </LinearGradient>
          <LinearGradient id="ondaAbajo" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#C8F1F4" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#E3EEFC" stopOpacity="0.4" />
          </LinearGradient>
        </Defs>
        <Path d="M215 0 C225 60 300 80 330 130 C360 180 380 200 400 215 L400 0 Z" fill="url(#ondaArriba)" />
        <Path d="M0 700 C70 690 120 740 170 790 C200 820 230 845 260 860 L0 860 Z" fill="url(#ondaAbajo)" />
      </Svg>
    </View>
  )
}
