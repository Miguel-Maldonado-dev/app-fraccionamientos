import { Redirect, Tabs } from 'expo-router'
import { DoorClosed, House, KeyRound, User, type LucideIcon } from 'lucide-react-native'
import { StyleSheet, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEstilos, useTema } from '../../src/lib/apariencia'
import { fuentes, sombraPara, type Esquema, type Paleta } from '../../src/lib/tema'
import { useSesion } from '../../src/sesion'

/** Ícono de pestaña; la activa se distingue por color azul, trazo más grueso y nombre en negritas. */
function icono(Icono: LucideIcon) {
  function IconoPestana({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <Icono color={color as string} size={24} strokeWidth={focused ? 2 : 1.75} />
    )
  }
  return IconoPestana
}

export default function TabsLayout() {
  const { session, yo } = useSesion()
  const { bottom } = useSafeAreaInsets()
  const colores = useTema()
  const styles = useEstilos(crearEstilos)
  // Alto base 64 (con 12 arriba para bajar los íconos) + el área segura inferior.
  const pie = Math.max(bottom, 10)
  if (!session || !yo) return <Redirect href="/login" />
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.secundario,
        tabBarStyle: [styles.barra, { height: 64 + pie, paddingTop: 12, paddingBottom: pie }],
        tabBarLabelStyle: { fontFamily: fuentes.textoFuerte, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icono(House) }} />
      <Tabs.Screen name="domicilio" options={{ title: 'Domicilio', tabBarIcon: icono(DoorClosed) }} />
      <Tabs.Screen name="accesos" options={{ title: 'Accesos', tabBarIcon: icono(KeyRound) }} />
      <Tabs.Screen name="cuenta" options={{ title: 'Cuenta', tabBarIcon: icono(User) }} />
    </Tabs>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    barra: {
      backgroundColor: colores.superficie,
      // Sin esquinas redondeadas: detrás asomaba el fondo de las pantallas con otro tono.
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colores.borde,
      ...sombraPara(esquema),
    },
  })
