import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { useApariencia, useEstilos, useTema } from '../lib/apariencia'
import { espacio, fuentes, radio, type Esquema, type Paleta } from '../lib/tema'

type Props = TextInputProps & { icono: LucideIcon; etiqueta: string }

/** Campo píldora: etiqueta arriba, ícono a la izquierda separado por línea fina; ojo si es seguro. */
export function Campo({ icono: Icono, etiqueta, secureTextEntry, style, ...resto }: Props) {
  const colores = useTema()
  const { esquema } = useApariencia()
  const styles = useEstilos(crearEstilos)
  const [visible, setVisible] = useState(false)
  return (
    <View style={styles.bloque}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={styles.pildora}>
        <Icono color={colores.primario} size={20} strokeWidth={1.8} />
        <View style={styles.divisor} />
        <TextInput
          accessibilityLabel={etiqueta}
          placeholderTextColor={esquema === 'claro' ? '#8A9BB0' : colores.secundario}
          {...resto}
          secureTextEntry={secureTextEntry && !visible}
          style={[styles.input, style]}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={12}
            onPress={() => setVisible((v) => !v)}
          >
            {visible ? <Eye color={colores.secundario} size={20} /> : <EyeOff color={colores.secundario} size={20} />}
          </Pressable>
        )}
      </View>
    </View>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    bloque: { gap: espacio.sm },
    etiqueta: { fontFamily: fuentes.textoFuerte, fontSize: 15, color: colores.navy },
    pildora: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colores.bordeCampo,
      borderRadius: radio.pildora,
      backgroundColor: colores.superficie,
      paddingHorizontal: espacio.md + 2,
      minHeight: 52,
    },
    divisor: { width: 1, height: 24, backgroundColor: colores.bordeCampo, marginHorizontal: espacio.sm + 4 },
    input: { flex: 1, fontFamily: fuentes.texto, fontSize: 16, color: colores.texto, paddingVertical: 12 },
  })
