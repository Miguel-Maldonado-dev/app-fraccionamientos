import { AlertTriangle } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BotonAcceso } from '../../src/components/boton-acceso'
import { FondoOndas } from '../../src/components/fondo-ondas'
import { Encabezado } from '../../src/components/encabezado'
import { Insignia } from '../../src/components/insignia'
import { TarjetaPin } from '../../src/components/tarjeta-pin'
import { ApiError, MENSAJE_SIN_CONEXION } from '../../src/lib/api'
import { debeCerrarSesion } from '../../src/lib/auth'
import { distribucion } from '../../src/lib/botones'
import { cargarEstado, type EstadoDomicilio } from '../../src/lib/inicio'
import { useEstilos, useTema } from '../../src/lib/apariencia'
import { espacio, fuentes, radio, sombraPara, type Esquema, type Paleta } from '../../src/lib/tema'
import { useDomicilio } from '../../src/sesion'

export default function Inicio() {
  const { domicilio } = useDomicilio()
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  const domicilioId = domicilio?.id ?? null
  const [estado, setEstado] = useState<EstadoDomicilio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const peticion = useRef(0)

  const cargar = useCallback(async () => {
    if (domicilioId === null) return
    const n = ++peticion.current
    setError(null)
    try {
      const e = await cargarEstado(domicilioId)
      if (n !== peticion.current) return
      setEstado(e)
    } catch (e) {
      if (n !== peticion.current) return
      if (debeCerrarSesion(e)) return // la sesión ya se cerró (alRechazarSesion)
      setEstado(null)
      setError(e instanceof ApiError && e.status !== 0 && e.status < 500 ? e.mensaje : MENSAJE_SIN_CONEXION)
    }
  }, [domicilioId])

  useEffect(() => {
    setCargando(true)
    setEstado(null)
    cargar().finally(() => setCargando(false))
  }, [cargar])

  const refrescar = async () => {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  const lados = estado ? distribucion(estado.botones) : []

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <FondoOndas />
      <Encabezado
        nombre={domicilio?.nombre || null}
        estatus={
          estado ? (
            <Insignia tipo={estado.moroso ? 'error' : 'ok'} texto={estado.moroso ? 'Con adeudo' : 'Al corriente'} />
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.contenido}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        testID="inicio-scroll"
      >
        {cargando && !estado ? (
          <ActivityIndicator color={colores.primario} style={{ marginTop: espacio.xl }} />
        ) : error ? (
          <View style={styles.errorCaja}>
            <Text style={styles.errorTexto}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={refrescar} style={styles.reintentar}>
              <Text style={styles.reintentarTexto}>Reintentar</Text>
            </Pressable>
          </View>
        ) : estado && domicilioId !== null ? (
          <>
            {estado.moroso && (
              <View style={styles.aviso} testID="aviso-moroso">
                <View style={styles.avisoIcono}>
                  <AlertTriangle color={colores.error} size={20} />
                </View>
                <Text style={styles.avisoTexto}>
                  Tu domicilio tiene adeudos. Los accesos remotos se reactivan al ponerte al corriente.
                </Text>
              </View>
            )}
            {estado.botones.length === 0 ? (
              <Text style={styles.vacio}>Aún no hay accesos configurados.</Text>
            ) : (
              <View style={styles.cuadricula}>
                {estado.botones.map((b, i) => (
                  <BotonAcceso key={b.id} boton={b} domicilioId={domicilioId} completo={lados[i] === 'completo'} />
                ))}
              </View>
            )}
            {!estado.moroso && estado.botones.some((b) => !b.habilitado) && (
              <Text style={styles.nota}>Los accesos en gris: este acceso no está disponible.</Text>
            )}
            <TarjetaPin pin={estado.pin} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colores.fondo },
    contenido: { flexGrow: 1, padding: espacio.md, paddingTop: espacio.sm, gap: espacio.md },
    cuadricula: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: espacio.sm + 4 },
    aviso: {
      flexDirection: 'row',
      gap: espacio.sm,
      alignItems: 'center',
      backgroundColor: colores.errorSuave,
      borderRadius: radio.xl,
      padding: espacio.md,
      ...sombraPara(esquema),
    },
    avisoIcono: { width: 40, height: 40, borderRadius: radio.md, backgroundColor: colores.superficie, alignItems: 'center', justifyContent: 'center' },
    avisoTexto: { flex: 1, fontFamily: fuentes.textoMedio, fontSize: 14, color: colores.error },
    vacio: { fontFamily: fuentes.texto, color: colores.secundario, textAlign: 'center' },
    nota: { fontFamily: fuentes.texto, fontSize: 13, color: colores.secundario },
    errorCaja: { alignItems: 'center', gap: espacio.md, marginTop: espacio.xl },
    errorTexto: { fontFamily: fuentes.textoMedio, color: colores.texto, textAlign: 'center' },
    reintentar: { backgroundColor: colores.primario, borderRadius: radio.pildora, paddingHorizontal: espacio.lg, paddingVertical: espacio.sm },
    reintentarTexto: { fontFamily: fuentes.textoFuerte, color: colores.sobrePrimario },
  })
