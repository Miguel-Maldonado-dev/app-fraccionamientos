import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Check, ChevronDown, ChevronRight, House, Info, KeyRound, LockKeyhole, LogOut, Palette, User } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BotonPrimario } from '../../src/components/boton-primario'
import { Campo } from '../../src/components/campo'
import { Fila, Pantalla, Seccion, useEstilosFormulario } from '../../src/components/pantalla'
import { supabase } from '../../src/lib/supabase'
import { formatoTelefono } from '../../src/lib/telefono'
import { useApariencia, useEstilos, useTema, type Preferencia } from '../../src/lib/apariencia'
import { espacio, fuentes, radio, sombraPara, type Esquema, type Paleta } from '../../src/lib/tema'
import { useDomicilio, useSesion } from '../../src/sesion'

export const MENSAJE_PASSWORD_CORTA = 'La contraseña debe tener al menos 8 caracteres'
export const MENSAJE_PASSWORD_DISTINTA = 'Las contraseñas no coinciden'
export const MENSAJE_PASSWORD_OK = 'Contraseña actualizada'

function version(): string {
  const v = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—'
  const b = Application.nativeBuildVersion
  return b ? `${v} (${b})` : v
}

function CambiarPassword() {
  const estilos = useEstilosFormulario()
  const colores = useTema()
  // Cerrada por omisión: solo la cabecera, como un botón; al tocarla aparecen los campos.
  const [abierta, setAbierta] = useState(false)
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function guardar() {
    if (enviando) return
    setOk(false)
    setError(null)
    if (nueva.length < 8) return setError(MENSAJE_PASSWORD_CORTA)
    if (nueva !== confirmar) return setError(MENSAJE_PASSWORD_DISTINTA)
    setEnviando(true)
    try {
      const { error: e } = await supabase.auth.updateUser({ password: nueva })
      if (e) setError(e.message || 'No se pudo cambiar la contraseña')
      else {
        setOk(true)
        setNueva('')
        setConfirmar('')
      }
    } catch {
      setError('Sin conexión, intenta de nuevo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Seccion
      titulo="Cambiar contraseña"
      icono={KeyRound}
      onPressCabeza={() => setAbierta((a) => !a)}
      accion={
        abierta ? (
          <ChevronDown color={colores.secundario} size={22} />
        ) : (
          <ChevronRight color={colores.secundario} size={22} />
        )
      }
    >
      {abierta ? (
        <>
          <Campo
            testID="nueva"
            icono={LockKeyhole}
            etiqueta="Nueva contraseña"
            placeholder="Mínimo 8 caracteres"
            value={nueva}
            onChangeText={setNueva}
            secureTextEntry
          />
          <Campo
            testID="confirmar"
            icono={LockKeyhole}
            etiqueta="Confirmar contraseña"
            placeholder="Repite la contraseña"
            value={confirmar}
            onChangeText={setConfirmar}
            secureTextEntry
          />
          {error ? (
            <Text style={estilos.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {ok ? <Text style={estilos.exito}>{MENSAJE_PASSWORD_OK}</Text> : null}
          <BotonPrimario
            testID="guardar-password"
            titulo={enviando ? 'Guardando…' : 'Guardar contraseña'}
            onPress={guardar}
            deshabilitado={enviando || !nueva}
          />
        </>
      ) : null}
    </Seccion>
  )
}

const OPCIONES: { valor: Preferencia; etiqueta: string }[] = [
  { valor: 'auto', etiqueta: 'Automático' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
]

function Apariencia() {
  const { preferencia, setPreferencia } = useApariencia()
  const styles = useEstilos(crearEstilos)
  return (
    <Seccion titulo="Apariencia" icono={Palette}>
      <View accessibilityRole="radiogroup" style={styles.segmentos}>
        {OPCIONES.map((o) => {
          const sel = o.valor === preferencia
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={o.etiqueta}
              onPress={() => setPreferencia(o.valor)}
              style={[styles.segmento, sel && styles.segmentoSel]}
            >
              <Text style={[styles.segmentoTexto, sel && styles.segmentoTextoSel]}>{o.etiqueta}</Text>
            </Pressable>
          )
        })}
      </View>
    </Seccion>
  )
}

export default function Cuenta() {
  const router = useRouter()
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  const { yo, salir } = useSesion()
  const { domicilio, domicilios, seleccionar } = useDomicilio()

  async function cerrarSesion() {
    await salir().catch(() => {})
    router.replace('/login')
  }

  return (
    <Pantalla titulo="Cuenta" conLogo>
      <View style={styles.perfil}>
        <View style={styles.avatar}>
          <User color={colores.primario} size={30} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.perfilEtiqueta}>Tu teléfono</Text>
          <Text style={styles.telefono}>{yo?.telefono ? formatoTelefono(yo.telefono) : '—'}</Text>
        </View>
      </View>
      <Seccion titulo="Mis domicilios" icono={House}>
        {domicilios.map((d) => (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityState={{ selected: d.id === domicilio?.id }}
            accessibilityLabel={`Seleccionar ${d.direccion}`}
            onPress={() => seleccionar(d.id)}
          >
            <Fila
              principal={d.direccion}
              secundario={`${d.fraccionamiento}${d.es_principal ? ' · Principal' : ''}`}
              derecha={
                d.id === domicilio?.id ? (
                  <View testID={`seleccionado-${d.id}`} style={styles.check}>
                    <Check color={colores.sobrePrimario} size={16} strokeWidth={3} />
                  </View>
                ) : undefined
              }
            />
          </Pressable>
        ))}
      </Seccion>
      <CambiarPassword />
      <Seccion titulo="Acerca de" icono={Info}>
        <Fila principal="WEADMI Residentes" secundario={`Versión ${version()}`} />
      </Seccion>
      <Apariencia />
      <Pressable accessibilityRole="button" onPress={cerrarSesion} style={({ pressed }) => [styles.salir, pressed && { opacity: 0.8 }]}>
        <LogOut color="#FFFFFF" size={20} strokeWidth={1.8} />
        <Text style={styles.salirTexto}>Cerrar sesión</Text>
      </Pressable>
    </Pantalla>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) => StyleSheet.create({
  perfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    backgroundColor: colores.superficie,
    borderRadius: radio.xl,
    padding: espacio.md + 4,
    ...sombraPara(esquema),
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colores.azulSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfilEtiqueta: { fontFamily: fuentes.texto, fontSize: 14, color: colores.secundario },
  telefono: { fontFamily: fuentes.tituloFuerte, fontSize: 22, color: colores.navy, marginTop: 2 },
  check: { width: 26, height: 26, borderRadius: 13, backgroundColor: colores.primario, alignItems: 'center', justifyContent: 'center' },
  salir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.sm,
    minHeight: 54,
    borderRadius: radio.pildora,
    // Rojo sólido con texto blanco en ambos temas.
    backgroundColor: '#D93636',
    marginBottom: espacio.lg,
  },
  salirTexto: { fontFamily: fuentes.textoFuerte, fontSize: 16, color: '#FFFFFF' },
  segmentos: { flexDirection: 'row', backgroundColor: colores.fondo, borderRadius: radio.pildora, padding: 4, gap: 4 },
  segmento: { flex: 1, minHeight: 40, borderRadius: radio.pildora, alignItems: 'center', justifyContent: 'center' },
  segmentoSel: { backgroundColor: colores.primario },
  segmentoTexto: { fontFamily: fuentes.textoMedio, fontSize: 14, color: colores.secundario },
  segmentoTextoSel: { fontFamily: fuentes.textoFuerte, color: colores.sobrePrimario },
})
