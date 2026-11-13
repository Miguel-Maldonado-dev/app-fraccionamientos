import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ApiError } from '../lib/api'
import { estiloBoton } from '../lib/estilos-boton'
import { iconoBoton } from '../lib/iconos'
import { abrir, type BotonEstado } from '../lib/inicio'
import { useApariencia, useEstilos, useTema } from '../lib/apariencia'
import { espacio, fuentes, radio, sombraPara, type Esquema, type Paleta } from '../lib/tema'


export const MENSAJE_NO_ABRIO = 'No se pudo abrir'
const DURACION_RESULTADO = 2000

type Fase = { tipo: 'normal' } | { tipo: 'abriendo' } | { tipo: 'abierto' } | { tipo: 'error'; mensaje: string }

export function BotonAcceso({
  boton,
  domicilioId,
  completo,
}: {
  boton: BotonEstado
  domicilioId: number
  completo: boolean
}) {
  const colores = useTema()
  const { esquema } = useApariencia()
  const styles = useEstilos(crearEstilos)
  const [fase, setFase] = useState<Fase>({ tipo: 'normal' })
  const enCurso = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (temporizador.current && clearTimeout(temporizador.current)), [])

  const mostrar = (f: Fase) => {
    setFase(f)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setFase({ tipo: 'normal' }), DURACION_RESULTADO)
  }

  const presionar = async () => {
    if (enCurso.current || !boton.habilitado) return
    enCurso.current = true
    if (temporizador.current) clearTimeout(temporizador.current)
    setFase({ tipo: 'abriendo' })
    try {
      const { status } = await abrir(domicilioId, boton.id)
      if (status === 'opened') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        mostrar({ tipo: 'abierto' })
      } else mostrar({ tipo: 'error', mensaje: MENSAJE_NO_ABRIO })
    } catch (e) {
      mostrar({ tipo: 'error', mensaje: e instanceof ApiError ? e.mensaje : MENSAJE_NO_ABRIO })
    } finally {
      enCurso.current = false
    }
  }

  const Icono = iconoBoton(boton.icono)
  const deshabilitado = !boton.habilitado
  const base = estiloBoton(boton.estilo, boton.habilitado, esquema)
  // Resultado: fondo suave verde/rojo sin degradado; el resto conserva la paleta del botón.
  const e =
    fase.tipo === 'abierto'
      ? { colores: [colores.exitoSuave], titulo: colores.exito, icono: colores.exito, chip: esquema === 'claro' ? '#CDEED5' : '#1F5133', flecha: colores.exito }
      : fase.tipo === 'error'
        ? { colores: [colores.errorSuave], titulo: colores.error, icono: colores.error, chip: esquema === 'claro' ? '#F8D3D3' : '#5A2A32', flecha: colores.error }
        : base
  const etiqueta =
    fase.tipo === 'abriendo' ? 'Abriendo…' : fase.tipo === 'abierto' ? 'Abierto ✓' : fase.tipo === 'error' ? fase.mensaje : boton.nombre
  const [c1, c2, ...resto] = e.colores

  const titulo = (
    <Text style={[styles.texto, completo && styles.textoCompleto, { color: e.titulo }]} numberOfLines={2}>
      {etiqueta}
    </Text>
  )
  const flecha = (
    <View style={[styles.chip, { backgroundColor: e.chip }]}>
      <ArrowRight color={e.flecha} size={20} />
    </View>
  )

  return (
    <Pressable
      testID={`boton-${boton.id}`}
      accessibilityRole="button"
      accessibilityLabel={boton.nombre}
      accessibilityState={{ disabled: deshabilitado || fase.tipo === 'abriendo', busy: fase.tipo === 'abriendo' }}
      disabled={deshabilitado || fase.tipo === 'abriendo'}
      onPress={() => void presionar()}
      style={({ pressed }) => [
        styles.boton,
        !deshabilitado && sombraPara(esquema),
        {
          backgroundColor: c1,
          width: completo ? '100%' : '48.5%',
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {c2 !== undefined && (
        <LinearGradient
          testID={`degradado-${boton.id}`}
          colors={[c1, c2, ...resto]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radio.xl }]}
        />
      )}
      {completo ? (
        <View style={styles.filaCompleta}>
          <Icono color={e.icono} size={34} strokeWidth={1.8} />
          {titulo}
          {flecha}
        </View>
      ) : (
        <View style={styles.columna}>
          <Icono color={e.icono} size={34} strokeWidth={1.8} />
          <View style={styles.filaMedia}>
            {titulo}
            {flecha}
          </View>
        </View>
      )}
    </Pressable>
  )
}

const crearEstilos = (colores: Paleta, esquema: Esquema) =>
  StyleSheet.create({
    boton: { borderRadius: radio.xl, minHeight: 108, padding: espacio.md + 4, justifyContent: 'center' },
    filaCompleta: { flexDirection: 'row', alignItems: 'center', gap: espacio.lg },
    columna: { gap: espacio.md },
    filaMedia: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
    texto: { flex: 1, fontFamily: fuentes.tituloFuerte, fontSize: 17 },
    textoCompleto: { fontSize: 22 },
    chip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  })
