import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora'
import { useFonts } from 'expo-font'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AparienciaProvider, useApariencia, useTema } from '../src/lib/apariencia'
import { fuentes } from '../src/lib/tema'
import { SesionProvider, useSesion } from '../src/sesion'

function Navegacion() {
  const { cargando, session, yo, errorInicio, reintentar } = useSesion()
  const colores = useTema()
  const { esquema } = useApariencia()
  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
        <ActivityIndicator color={colores.primario} />
      </View>
    )
  }
  if (session && !yo && errorInicio) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colores.fondo }}>
        <Text accessibilityRole="alert" style={{ fontFamily: fuentes.texto, color: colores.texto, marginBottom: 16, textAlign: 'center' }}>
          {errorInicio}
        </Text>
        <Pressable accessibilityRole="button" onPress={reintentar}>
          <Text style={{ fontFamily: fuentes.textoFuerte, color: colores.primario }}>Reintentar</Text>
        </Pressable>
      </View>
    )
  }
  // El fondo del navegador asoma detrás de las esquinas redondeadas de la barra de pestañas:
  // debe ser el mismo fondo de las pantallas en ambos temas.
  const base = esquema === 'oscuro' ? DarkTheme : DefaultTheme
  const tema = { ...base, colors: { ...base.colors, background: colores.fondo, card: colores.superficie } }
  return (
    <ThemeProvider value={tema}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colores.fondo } }} />
    </ThemeProvider>
  )
}

function BarraEstado() {
  const { esquema } = useApariencia()
  return <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />
}

export default function RootLayout() {
  const [listas] = useFonts({ Sora_600SemiBold, Sora_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold })
  if (!listas) return null
  return (
    <SafeAreaProvider>
      <AparienciaProvider>
        <SesionProvider>
          <BarraEstado />
          <Navegacion />
        </SesionProvider>
      </AparienciaProvider>
    </SafeAreaProvider>
  )
}
