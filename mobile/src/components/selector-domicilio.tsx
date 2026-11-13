import { Check, ChevronRight, House } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useEstilos, useTema } from '../lib/apariencia'
import { espacio, fuentes, radio, type Esquema, type Paleta } from '../lib/tema'
import { useDomicilio } from '../sesion'

/** Domicilio activo; con más de uno, abre una lista para cambiarlo. */
export function SelectorDomicilio({ extra }: { extra?: ReactNode } = {}) {
  const { domicilio, domicilios, seleccionar } = useDomicilio()
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  const [abierto, setAbierto] = useState(false)
  if (!domicilio) return null
  const texto = (
    <>
      <View style={styles.icono}>
        <House color={colores.primario} size={24} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.direccion}>{domicilio.direccion}</Text>
        <Text style={styles.fracc}>{domicilio.fraccionamiento}</Text>
      </View>
      {extra}
    </>
  )
  if (domicilios.length <= 1) return <View style={styles.fila}>{texto}</View>
  return (
    <>
      <Pressable
        testID="selector-domicilio"
        accessibilityRole="button"
        accessibilityLabel="Cambiar domicilio"
        style={[styles.fila, styles.selector]}
        onPress={() => setAbierto(true)}
      >
        {texto}
        <ChevronRight color={colores.secundario} size={22} />
      </Pressable>
      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={styles.velo} onPress={() => setAbierto(false)}>
          <View style={styles.hoja}>
            <Text style={styles.tituloHoja}>Elige un domicilio</Text>
            {domicilios.map((d) => (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                style={styles.opcion}
                onPress={() => {
                  seleccionar(d.id)
                  setAbierto(false)
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcionTexto}>{d.direccion}</Text>
                  <Text style={styles.opcionSub}>{d.fraccionamiento}</Text>
                </View>
                {d.id === domicilio.id && <Check color={colores.primario} size={20} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md },
    icono: { width: 48, height: 48, borderRadius: radio.md, backgroundColor: colores.azulSuave, alignItems: 'center', justifyContent: 'center' },
    selector: { borderRadius: radio.md },
    direccion: { fontFamily: fuentes.textoFuerte, fontSize: 17, textTransform: 'uppercase', color: colores.navy },
    fracc: { fontFamily: fuentes.texto, fontSize: 15, color: colores.secundario },
    velo: { flex: 1, backgroundColor: esquema === 'claro' ? 'rgba(7,31,73,0.5)' : 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    hoja: { backgroundColor: colores.superficie, padding: espacio.md, borderTopLeftRadius: radio.lg, borderTopRightRadius: radio.lg },
    tituloHoja: { fontFamily: fuentes.titulo, fontSize: 18, color: colores.navy, marginBottom: espacio.sm },
    opcion: { flexDirection: 'row', alignItems: 'center', paddingVertical: espacio.md, borderBottomWidth: 1, borderColor: colores.borde },
    opcionTexto: { fontFamily: fuentes.textoMedio, fontSize: 15, color: colores.texto },
    opcionSub: { fontFamily: fuentes.texto, fontSize: 13, color: colores.secundario },
  })
