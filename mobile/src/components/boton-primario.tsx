import { LinearGradient } from 'expo-linear-gradient'
import type { LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useEstilos } from '../lib/apariencia'
import { degradadoPrimario, espacio, fuentes, radio, type Esquema, type Paleta } from '../lib/tema'

type Props = {
  titulo: string
  onPress: () => void
  cargando?: boolean
  deshabilitado?: boolean
  icono?: LucideIcon
  testID?: string
}

/** Botón píldora con degradado azul y texto blanco. */
export function BotonPrimario({ titulo, onPress, cargando = false, deshabilitado = false, icono: Icono, testID }: Props) {
  const styles = useEstilos(crearEstilos)
  const inactivo = deshabilitado || cargando
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={onPress}
      style={({ pressed }) => [styles.boton, { opacity: pressed ? 0.88 : deshabilitado ? 0.55 : 1 }]}
    >
      <LinearGradient colors={degradadoPrimario} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.contenido}>
        {cargando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            {Icono && <Icono color="#FFFFFF" size={20} />}
            <Text style={styles.texto}>{titulo}</Text>
          </>
        )}
      </View>
    </Pressable>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    boton: {
      borderRadius: radio.pildora,
      overflow: 'hidden',
      minHeight: 54,
      justifyContent: 'center',
      shadowColor: colores.primario,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    contenido: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.sm, paddingHorizontal: espacio.lg },
    texto: { fontFamily: fuentes.textoFuerte, fontSize: 17, color: '#FFFFFF' },
  })
