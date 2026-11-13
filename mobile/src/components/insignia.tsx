import { StyleSheet, Text, View } from 'react-native'
import { useEstilos, useTema } from '../lib/apariencia'
import { espacio, fuentes, radio, type Esquema, type Paleta } from '../lib/tema'

/** Píldora de estatus: ok (verde suave con punto) o error (rojo suave). */
export function Insignia({ tipo, texto, testID }: { tipo: 'ok' | 'error'; texto: string; testID?: string }) {
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  const color = tipo === 'ok' ? colores.exito : colores.error
  return (
    <View testID={testID} style={[styles.pildora, { backgroundColor: tipo === 'ok' ? colores.exitoSuave : colores.errorSuave }]}>
      <View style={[styles.punto, { backgroundColor: color }]} />
      <Text style={[styles.texto, { color }]}>{texto}</Text>
    </View>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    pildora: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      borderRadius: radio.pildora,
      paddingHorizontal: espacio.sm + 4,
      paddingVertical: 6,
    },
    punto: { width: 8, height: 8, borderRadius: 4 },
    texto: { fontFamily: fuentes.textoFuerte, fontSize: 14 },
  })
