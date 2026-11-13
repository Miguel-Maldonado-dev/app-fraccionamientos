import { LinearGradient } from 'expo-linear-gradient'
import { CreditCard, Eye, EyeOff, Info, LockKeyhole, Phone, RadioTower } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Fila, Pantalla, Seccion, Vacio } from '../../src/components/pantalla'
import { SelectorDomicilio } from '../../src/components/selector-domicilio'
import { cargarAccesos } from '../../src/lib/domicilio'
import { formatoTelefono } from '../../src/lib/telefono'
import { useEstilos, useTema } from '../../src/lib/apariencia'
import { degradadoPrimario, espacio, fuentes, radio, sombraPara, type Esquema, type Paleta } from '../../src/lib/tema'
import { useCarga } from '../../src/lib/use-carga'
import { useDomicilio } from '../../src/sesion'

/** PIN destacado sobre degradado azul, oculto por omisión. */
function Pin({ pin }: { pin: string | null }) {
  const [visible, setVisible] = useState(false)
  const styles = useEstilos(crearEstilos)
  return (
    <View style={styles.pinTarjeta}>
      <LinearGradient colors={degradadoPrimario} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.pinIcono}>
        <LockKeyhole color="#FFFFFF" size={24} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pinEtiqueta}>PIN de acceso</Text>
        {pin === null ? (
          <Text style={styles.pinVacio}>Este domicilio no tiene PIN.</Text>
        ) : (
          <Text style={styles.pin} testID="pin-accesos">
            {visible ? pin : '•'.repeat(Math.max(pin.length, 4))}
          </Text>
        )}
      </View>
      {pin !== null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar PIN' : 'Mostrar PIN'}
          hitSlop={12}
          onPress={() => setVisible((v) => !v)}
          style={styles.ojo}
        >
          {visible ? <EyeOff color="#FFFFFF" size={22} /> : <Eye color="#FFFFFF" size={22} />}
        </Pressable>
      )}
    </View>
  )
}

/** Medios de acceso del domicilio (solo lectura; los administra la administración). */
export default function Accesos() {
  const { domicilio } = useDomicilio()
  const styles = useEstilos(crearEstilos)
  const colores = useTema()
  const id = domicilio?.id ?? null
  const cargar = useCallback(() => cargarAccesos(id as number), [id])
  const { datos, error, cargando, refrescar, refrescando } = useCarga(id === null ? null : cargar)

  return (
    <Pantalla
      titulo="Accesos"
      conLogo
      cabecera={<SelectorDomicilio />}
      cargando={cargando}
      error={error}
      onRefrescar={refrescar}
      refrescando={refrescando}
    >
      {datos && (
        <>
          <Pin pin={datos.pin} />
          <Seccion titulo="Tarjetas" icono={CreditCard}>
            {datos.tarjetas.length === 0 ? (
              <Vacio texto="Sin tarjetas registradas." />
            ) : (
              datos.tarjetas.map((t) => (
                <Fila key={t.id} principal={t.numero} secundario={t.descripcion} />
              ))
            )}
          </Seccion>
          <Seccion titulo="Controles" icono={RadioTower}>
            {datos.controles.length === 0 ? (
              <Vacio texto="Sin controles registrados." />
            ) : (
              datos.controles.map((c) => (
                <Fila
                  key={c.id}
                  principal={c.descripcion || c.control_id || `Control ${c.id}`}
                  secundario={c.descripcion ? c.control_id : null}
                />
              ))
            )}
          </Seccion>
          <Seccion titulo="Teléfonos" icono={Phone}>
            {datos.telefonos.length === 0 ? (
              <Vacio texto="Sin teléfonos registrados." />
            ) : (
              datos.telefonos.map((t) => <Fila key={t.id} principal={formatoTelefono(t.telefono)} />)
            )}
          </Seccion>
          <View style={styles.notaCaja}>
            <Info color={colores.primario} size={20} strokeWidth={1.8} />
            <Text style={styles.nota}>Para cambios en tus accesos, contacta a la administración.</Text>
          </View>
        </>
      )}
    </Pantalla>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    pinTarjeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.md,
      borderRadius: radio.xl,
      overflow: 'hidden',
      padding: espacio.md + 4,
      backgroundColor: degradadoPrimario[1],
      ...sombraPara(esquema),
    },
    pinIcono: {
      width: 48,
      height: 48,
      borderRadius: radio.md + 2,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinEtiqueta: { fontFamily: fuentes.textoMedio, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
    pin: { fontFamily: fuentes.tituloFuerte, fontSize: 30, color: '#FFFFFF', letterSpacing: 6, marginTop: 2 },
    pinVacio: { fontFamily: fuentes.textoMedio, fontSize: 15, color: '#FFFFFF', marginTop: 4 },
    ojo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    notaCaja: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.sm,
      backgroundColor: colores.azulSuave,
      borderRadius: radio.lg,
      padding: espacio.md,
    },
    nota: { flex: 1, fontFamily: fuentes.texto, fontSize: 14, color: colores.secundario },
  })
