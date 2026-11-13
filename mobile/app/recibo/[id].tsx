import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Calendar, ChevronLeft, CreditCard, Hash, Layers, ReceiptText, Share, type LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BotonPrimario } from '../../src/components/boton-primario'
import { IconoSeccion } from '../../src/components/icono-seccion'
import { Insignia } from '../../src/components/insignia'
import { Pantalla, useEstilosFormulario } from '../../src/components/pantalla'
import { cargarPago, compartirRecibo, fecha, moneda } from '../../src/lib/domicilio'
import { useEstilos, useTema } from '../../src/lib/apariencia'
import { espacio, fuentes, radio, sombraPara, type Esquema, type Paleta } from '../../src/lib/tema'
import { mensajeDeCarga, useCarga } from '../../src/lib/use-carga'

function Dato({
  icono,
  etiqueta,
  valor,
  primero,
  compacto,
}: {
  icono: LucideIcon
  etiqueta: string
  valor: string
  primero?: boolean
  /** Valores largos (referencia): letra chica y en una sola línea, reduciéndose si no cabe. */
  compacto?: boolean
}) {
  const styles = useEstilos(crearEstilos)
  return (
    <View style={[styles.dato, !primero && styles.datoBorde]}>
      <IconoSeccion icono={icono} tamano={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
        {compacto ? (
          <Text style={[styles.datoValor, styles.datoCompacto]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {valor}
          </Text>
        ) : (
          <Text style={styles.datoValor}>{valor}</Text>
        )}
      </View>
    </View>
  )
}

export default function Recibo() {
  const estilos = useEstilosFormulario()
  const styles = useEstilos(crearEstilos)
  const colores = useTema()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const pagoId = Number(id)
  const cargar = useCallback(async () => {
    const p = await cargarPago(pagoId)
    if (!p) throw new Error('Recibo no disponible')
    return p
  }, [pagoId])
  const { datos: pago, error, cargando, refrescar } = useCarga(cargar)
  const [compartiendo, setCompartiendo] = useState(false)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)

  async function compartir() {
    if (compartiendo) return
    setCompartiendo(true)
    setErrorPdf(null)
    try {
      await compartirRecibo(pagoId)
    } catch (e) {
      setErrorPdf(mensajeDeCarga(e))
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Pantalla
        titulo="Recibo"
        cabecera={
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.volver}>
            <ChevronLeft color={colores.primario} size={22} />
            <Text style={styles.volverTexto}>Volver</Text>
          </Pressable>
        }
        cargando={cargando}
        error={error}
        onRefrescar={refrescar}
      >
        {pago && (
          <View style={styles.tarjeta}>
            <View style={styles.cabeza}>
              <IconoSeccion icono={ReceiptText} tamano={64} />
              <View style={styles.divisor} />
              <View style={{ flex: 1, gap: espacio.sm }}>
                <Text style={styles.importe}>{moneda(pago.importe)}</Text>
                <Insignia tipo="ok" texto="Pagado" />
              </View>
            </View>
            <View>
              {[
                { icono: Layers, etiqueta: 'Concepto', valor: pago.concepto },
                { icono: Calendar, etiqueta: 'Fecha de pago', valor: fecha(pago.fecha_pago) },
                { icono: CreditCard, etiqueta: 'Método de pago', valor: pago.metodo_pago },
                { icono: Hash, etiqueta: 'Referencia', valor: pago.referencia },
              ]
                .filter((d): d is { icono: LucideIcon; etiqueta: string; valor: string } => !!d.valor)
                .map((d, i) => (
                  <Dato key={d.etiqueta} icono={d.icono} etiqueta={d.etiqueta} valor={d.valor} primero={i === 0} compacto={d.etiqueta === 'Referencia'} />
                ))}
            </View>
            {errorPdf ? <Text style={estilos.error}>{errorPdf}</Text> : null}
            {pago.tiene_recibo ? (
              <BotonPrimario
                titulo={compartiendo ? 'Preparando…' : 'Compartir PDF'}
                icono={Share}
                onPress={compartir}
                deshabilitado={compartiendo}
                testID="compartir-pdf"
              />
            ) : (
              <Text style={styles.nota}>Este pago no tiene recibo.</Text>
            )}
          </View>
        )}
      </Pantalla>
    </>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    volver: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
    volverTexto: { fontFamily: fuentes.textoFuerte, fontSize: 17, color: colores.primario },
    tarjeta: { backgroundColor: colores.superficie, borderRadius: radio.xl, padding: espacio.sm + 4, gap: espacio.md, ...sombraPara(esquema) },
    cabeza: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.md,
      backgroundColor: colores.azulSuave,
      borderRadius: radio.xl,
      padding: espacio.md,
    },
    divisor: { width: 1, alignSelf: 'stretch', backgroundColor: colores.bordeCampo },
    importe: { fontFamily: fuentes.tituloFuerte, fontSize: 30, color: colores.navy },
    dato: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, paddingVertical: espacio.sm + 4, paddingHorizontal: espacio.xs },
    datoBorde: { borderTopWidth: 1, borderTopColor: colores.borde },
    datoEtiqueta: { fontFamily: fuentes.texto, fontSize: 14, color: colores.secundario },
    datoValor: { fontFamily: fuentes.textoFuerte, fontSize: 17, color: colores.navy, marginTop: 2 },
    datoCompacto: { fontFamily: fuentes.textoMedio, fontSize: 13 },
    nota: { fontFamily: fuentes.texto, color: colores.secundario, textAlign: 'center', paddingBottom: espacio.sm },
  })
