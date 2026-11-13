import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEstilos, useTema } from '../lib/apariencia'
import { espacio, fuentes, radio, sombraPara, type Esquema, type Paleta } from '../lib/tema'
import { FondoOndas } from './fondo-ondas'
import { IconoSeccion } from './icono-seccion'
import { Logotipo } from './logotipo'


type Props = {
  titulo?: string
  /** Muestra el logotipo WEADMI arriba a la izquierda. */
  conLogo?: boolean
  children?: ReactNode
  /** Contenido bajo el título (p. ej. el selector de domicilio). */
  cabecera?: ReactNode
  cargando?: boolean
  error?: string | null
  onRefrescar?: () => Promise<void>
  refrescando?: boolean
  testID?: string
}

/** Pantalla sobre fondo con ondas: logotipo opcional, título grande y contenido desplazable. */
export function Pantalla({ titulo, conLogo = false, children, cabecera, cargando, error, onRefrescar, refrescando = false, testID }: Props) {
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <FondoOndas />
      {(conLogo || titulo || cabecera) && (
        <View style={styles.franja}>
          {conLogo && <Logotipo style={styles.logo} />}
          {titulo ? (
            <Text style={styles.titulo} accessibilityRole="header">
              {titulo}
            </Text>
          ) : null}
          {cabecera}
        </View>
      )}
      <ScrollView
        testID={testID}
        contentContainerStyle={styles.contenido}
        refreshControl={onRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={onRefrescar} /> : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {cargando ? (
          <ActivityIndicator color={colores.primario} style={{ marginTop: espacio.xl }} />
        ) : error ? (
          <View style={styles.errorCaja}>
            <Text style={styles.errorTexto}>{error}</Text>
            {onRefrescar && (
              <Pressable accessibilityRole="button" onPress={onRefrescar} style={styles.boton}>
                <Text style={styles.botonTexto}>Reintentar</Text>
              </Pressable>
            )}
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

/** Tarjeta blanca con encabezado de sección. */
export function Seccion({
  titulo,
  icono,
  accion,
  onPressCabeza,
  children,
}: {
  titulo: string
  /** Hace tocable la cabecera (p. ej. para abrir/cerrar la sección). */
  onPressCabeza?: () => void
  /** Ícono de línea en cuadro azul suave a la izquierda del título. */
  icono?: LucideIcon
  accion?: ReactNode
  children?: ReactNode
}) {
  const styles = useEstilos(crearEstilos)
  return (
    <View style={styles.seccion}>
      {onPressCabeza ? (
        <Pressable accessibilityRole="button" accessibilityLabel={titulo} onPress={onPressCabeza} style={styles.seccionCabeza}>
          {icono ? <IconoSeccion icono={icono} tamano={44} /> : null}
          <Text style={[styles.seccionTitulo, icono && styles.seccionTituloIcono]}>{titulo}</Text>
          {accion}
        </Pressable>
      ) : (
        <View style={styles.seccionCabeza}>
          {icono ? <IconoSeccion icono={icono} tamano={44} /> : null}
          <Text style={[styles.seccionTitulo, icono && styles.seccionTituloIcono]}>{titulo}</Text>
          {accion}
        </View>
      )}
      {children}
    </View>
  )
}

export function Fila({ principal, secundario, derecha }: { principal: string; secundario?: string | null; derecha?: ReactNode }) {
  const styles = useEstilos(crearEstilos)
  return (
    <View style={styles.fila}>
      <View style={{ flex: 1 }}>
        <Text style={styles.filaPrincipal}>{principal}</Text>
        {secundario ? <Text style={styles.filaSecundario}>{secundario}</Text> : null}
      </View>
      {derecha}
    </View>
  )
}

export function Vacio({ texto }: { texto: string }) {
  const styles = useEstilos(crearEstilos)
  return <Text style={styles.vacio}>{texto}</Text>
}

export function Enlace({ texto, onPress, peligro, etiqueta }: { texto: string; onPress: () => void; peligro?: boolean; etiqueta?: string }) {
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiqueta} hitSlop={8} onPress={onPress}>
      <Text style={[styles.enlace, peligro && { color: colores.error }]}>{texto}</Text>
    </Pressable>
  )
}

/** Mensajes de formulario (error/éxito) según el tema. */
export function useEstilosFormulario() {
  return useEstilos(crearEstilosFormulario)
}

const crearEstilosFormulario = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    error: { fontFamily: fuentes.texto, color: colores.error, marginBottom: espacio.md },
    exito: { fontFamily: fuentes.textoMedio, color: esquema === 'claro' ? '#2E7D32' : colores.exito, marginBottom: espacio.md },
  })

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colores.fondo },
    franja: { paddingHorizontal: espacio.md, paddingTop: espacio.sm, paddingBottom: espacio.sm, gap: espacio.sm },
    logo: { width: 170, height: 40, marginBottom: espacio.sm },
    titulo: { fontFamily: fuentes.tituloFuerte, fontSize: 26, color: colores.navy },
    contenido: { flexGrow: 1, padding: espacio.md, gap: espacio.md },
    errorCaja: { alignItems: 'center', gap: espacio.md, marginTop: espacio.xl },
    errorTexto: { fontFamily: fuentes.textoMedio, color: colores.texto, textAlign: 'center' },
    boton: {
      backgroundColor: colores.primario,
      borderRadius: radio.md,
      paddingHorizontal: espacio.lg,
      paddingVertical: 12,
      alignItems: 'center',
    },
    botonTexto: { fontFamily: fuentes.textoFuerte, color: colores.sobrePrimario, fontSize: 15 },
    seccion: {
      backgroundColor: colores.superficie,
      borderRadius: radio.xl,
      padding: espacio.md + 4,
      ...sombraPara(esquema),
      gap: espacio.sm,
    },
    seccionCabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.md },
    seccionTitulo: { flex: 1, fontFamily: fuentes.titulo, fontSize: 15, color: colores.navy },
    seccionTituloIcono: { fontFamily: fuentes.tituloFuerte, fontSize: 16 },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.sm,
      paddingVertical: espacio.sm,
      borderTopWidth: 1,
      borderTopColor: colores.borde,
    },
    filaPrincipal: { fontFamily: fuentes.textoMedio, fontSize: 15, color: colores.texto },
    filaSecundario: { fontFamily: fuentes.texto, fontSize: 13, color: colores.secundario, marginTop: 2 },
    vacio: { fontFamily: fuentes.texto, color: colores.secundario, fontSize: 14 },
    enlace: { fontFamily: fuentes.textoFuerte, color: colores.primario, fontSize: 14 },
  })
