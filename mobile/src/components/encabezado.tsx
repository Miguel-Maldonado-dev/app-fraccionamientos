import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useEstilos } from '../lib/apariencia'
import { espacio, fuentes, type Esquema, type Paleta } from '../lib/tema'
import { Logotipo } from './logotipo'
import { SelectorDomicilio } from './selector-domicilio'

export function Encabezado({ nombre, estatus }: { nombre: string | null; estatus?: ReactNode }) {
  const styles = useEstilos(crearEstilos)
  return (
    <View style={styles.caja}>
      <Logotipo style={styles.logo} />
      <Text style={styles.hola} accessibilityRole="header">
        {nombre ? `Hola, ${nombre}` : 'Hola'}
      </Text>
      <SelectorDomicilio extra={estatus} />
    </View>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    caja: { paddingHorizontal: espacio.md, paddingTop: espacio.sm, paddingBottom: espacio.md, gap: espacio.md },
    logo: { width: 170, height: 40 },
    hola: { fontFamily: fuentes.tituloFuerte, fontSize: 26, color: colores.navy },
  })
