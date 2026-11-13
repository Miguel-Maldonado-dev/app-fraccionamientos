import { Eye, EyeOff, LockKeyhole } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useEstilos, useTema } from '../lib/apariencia'
import { espacio, fuentes, type Esquema, type Paleta } from '../lib/tema'
import { IconoSeccion } from './icono-seccion'
import { Tarjeta } from './tarjeta'

export function TarjetaPin({ pin }: { pin: string | null }) {
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  const [visible, setVisible] = useState(false)
  return (
    <Tarjeta style={styles.tarjeta}>
      <IconoSeccion icono={LockKeyhole} />
      <View style={styles.divisor} />
      <View style={{ flex: 1 }}>
        <Text style={styles.etiqueta}>PIN de acceso</Text>
        <View style={styles.fila}>
          <Text style={styles.pin} testID="pin">
            {pin === null ? 'Sin PIN' : visible ? pin : '••••'}
          </Text>
          {pin !== null && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? 'Ocultar PIN' : 'Mostrar PIN'}
              hitSlop={12}
              onPress={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff color={colores.secundario} size={22} /> : <Eye color={colores.secundario} size={22} />}
            </Pressable>
          )}
        </View>
      </View>
    </Tarjeta>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    tarjeta: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
    divisor: { width: 1, alignSelf: 'stretch', backgroundColor: colores.borde },
    etiqueta: { fontFamily: fuentes.texto, fontSize: 14, color: colores.secundario },
    fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, marginTop: espacio.xs },
    pin: { fontFamily: fuentes.tituloFuerte, fontSize: 22, color: colores.texto, letterSpacing: 4 },
  })
