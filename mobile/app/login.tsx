import { Redirect } from 'expo-router'
import { LockKeyhole, Smartphone } from 'lucide-react-native'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BotonPrimario } from '../src/components/boton-primario'
import { Campo } from '../src/components/campo'
import { Logotipo } from '../src/components/logotipo'
import { FondoOndas } from '../src/components/fondo-ondas'
import { Tarjeta } from '../src/components/tarjeta'
import { useEstilos } from '../src/lib/apariencia'
import { espacio, fuentes, type Esquema, type Paleta } from '../src/lib/tema'
import { useSesion } from '../src/sesion'

const AVISO_OLVIDO = 'Pide a la administración que restablezca tu contraseña.'

export default function Login() {
  const { session, yo, aviso, entrar } = useSesion()
  const styles = useEstilos(crearEstilos)
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [olvido, setOlvido] = useState(false)

  if (session && yo) return <Redirect href="/" />
  const mensaje = error ?? aviso

  async function enviar() {
    if (enviando) return
    setEnviando(true)
    setError(null)
    const r = await entrar(telefono, password)
    setEnviando(false)
    if (!r.ok) setError(r.mensaje)
  }

  return (
    <SafeAreaView style={styles.pantalla}>
      <FondoOndas />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <Logotipo style={styles.logo} contenedor={styles.logoCaja} />
          <Text style={styles.titulo} accessibilityRole="header">
            Iniciar sesión
          </Text>
          <Tarjeta style={styles.tarjeta}>
            <Campo
              icono={Smartphone}
              etiqueta="Teléfono"
              testID="telefono"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="10 dígitos"
            />
            <Campo
              icono={LockKeyhole}
              etiqueta="Contraseña"
              testID="password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="Tu contraseña"
              onSubmitEditing={enviar}
            />
            <Pressable
              accessibilityRole="link"
              onPress={() => setOlvido(true)}
              hitSlop={8}
              style={styles.olvido}
            >
              <Text style={styles.olvidoTexto}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
            {olvido ? <Text style={styles.nota}>{AVISO_OLVIDO}</Text> : null}
            {mensaje ? (
              <Text style={styles.error} accessibilityRole="alert">
                {mensaje}
              </Text>
            ) : null}
            <BotonPrimario titulo="Entrar" onPress={enviar} cargando={enviando} testID="entrar" />
          </Tarjeta>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: colores.fondo },
    contenido: { flexGrow: 1, justifyContent: 'center', padding: espacio.md, paddingVertical: espacio.xl },
    logoCaja: { alignSelf: 'center', marginBottom: espacio.xl + espacio.md },
    logo: { width: 260, height: 64 },
    titulo: { fontFamily: fuentes.tituloFuerte, fontSize: 32, color: colores.navy, marginBottom: espacio.lg, marginLeft: espacio.sm },
    tarjeta: { gap: espacio.md, padding: espacio.lg },
    olvido: { alignSelf: 'flex-end' },
    olvidoTexto: { fontFamily: fuentes.textoFuerte, fontSize: 14, color: colores.primario },
    nota: { fontFamily: fuentes.texto, fontSize: 14, color: colores.secundario },
    error: { fontFamily: fuentes.texto, color: colores.error },
  })
