import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ChevronLeft, LockKeyhole, Smartphone, User, UserPlus } from 'lucide-react-native'
import { Pressable, StyleSheet, Text } from 'react-native'
import { BotonPrimario } from '../../src/components/boton-primario'
import { Campo } from '../../src/components/campo'
import { Pantalla, Seccion, useEstilosFormulario } from '../../src/components/pantalla'
import { agregarResidente, MENSAJE_CUENTA_CREADA, MENSAJE_CUENTA_VINCULADA } from '../../src/lib/domicilio'
import { useEstilos, useTema } from '../../src/lib/apariencia'
import { fuentes, type Paleta } from '../../src/lib/tema'
import { mensajeDeCarga } from '../../src/lib/use-carga'

export default function AgregarResidente() {
  const estilos = useEstilosFormulario()
  const styles = useEstilos(crearEstilos)
  const colores = useTema()
  const router = useRouter()
  const { domicilio } = useLocalSearchParams<{ domicilio: string }>()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (enviando) return
    setEnviando(true)
    setError(null)
    try {
      const r = await agregarResidente(Number(domicilio), {
        nombre: nombre.trim(),
        telefono,
        ...(password ? { password } : {}),
      })
      setExito(r.cuentaCreada ? MENSAJE_CUENTA_CREADA : MENSAJE_CUENTA_VINCULADA)
    } catch (e) {
      // Errores del servidor tal cual (validación, máximo de residentes, etc.).
      setError(mensajeDeCarga(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Pantalla titulo="Agregar residente" cabecera={
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.volver}>
          <ChevronLeft color={colores.primario} size={22} />
          <Text style={styles.volverTexto}>Volver</Text>
        </Pressable>
      }>
      {exito ? (
        <Seccion titulo="Listo">
          <Text style={estilos.exito} accessibilityRole="alert">
            {exito}
          </Text>
          <BotonPrimario titulo="Volver al domicilio" onPress={() => router.back()} />
        </Seccion>
      ) : (
        <Seccion titulo="Datos del residente" icono={UserPlus}>
          <Campo testID="nombre" icono={User} etiqueta="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
          <Campo
            testID="telefono"
            icono={Smartphone}
            etiqueta="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            placeholder="10 dígitos"
          />
          <Campo
            testID="password"
            icono={LockKeyhole}
            etiqueta="Contraseña (solo si el teléfono aún no tiene cuenta)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mínimo 8 caracteres"
          />
          {error ? (
            <Text style={estilos.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <BotonPrimario
            testID="agregar"
            titulo={enviando ? 'Agregando…' : 'Agregar residente'}
            onPress={enviar}
            deshabilitado={enviando || !nombre.trim() || !telefono.trim()}
          />
        </Seccion>
      )}
    </Pantalla>
  )
}

const crearEstilos = (colores: Paleta) =>
  StyleSheet.create({
    volver: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
    volverTexto: { fontFamily: fuentes.textoFuerte, fontSize: 17, color: colores.primario },
  })
