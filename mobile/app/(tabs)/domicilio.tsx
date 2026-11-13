import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Coins, ReceiptText, Users } from 'lucide-react-native'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { Enlace, Fila, Pantalla, Seccion, Vacio } from '../../src/components/pantalla'
import { SelectorDomicilio } from '../../src/components/selector-domicilio'
import {
  cargarCuotas,
  cargarPagos,
  cargarResidentes,
  fecha,
  moneda,
  quitarResidente,
  type Cuota,
} from '../../src/lib/domicilio'
import { useApariencia, useEstilos, useTema } from '../../src/lib/apariencia'
import { espacio, fuentes, radio, type Esquema, type Paleta } from '../../src/lib/tema'
import { debeCerrarSesion } from '../../src/lib/auth'
import { mensajeDeCarga, useCarga } from '../../src/lib/use-carga'
import { useDomicilio } from '../../src/sesion'

type ColorChip = { fondo: string; texto: string }

function coloresEstatus(colores: Paleta, esquema: Esquema): Record<string, ColorChip> {
  const oscuro = esquema === 'oscuro'
  return {
    Pagado: { fondo: colores.exitoSuave, texto: colores.exito },
    Pendiente: { fondo: colores.azulSuave, texto: colores.primario },
    'En gracia': oscuro ? { fondo: '#3A2E12', texto: '#F0B84D' } : { fondo: '#FFF6E5', texto: '#9A6200' },
    Vencido: { fondo: colores.errorSuave, texto: colores.error },
  }
}

function Estatus({ cuota }: { cuota: Cuota }) {
  const styles = useEstilos(crearEstilos)
  const colores = useTema()
  const { esquema } = useApariencia()
  const e = cuota.estatus_calculado ?? '—'
  const c = coloresEstatus(colores, esquema)[e] ?? { fondo: colores.fondo, texto: colores.secundario }
  return (
    <View style={[styles.chip, { backgroundColor: c.fondo }]}>
      <Text style={[styles.chipTexto, { color: c.texto }]}>{e}</Text>
    </View>
  )
}

function avatares(colores: Paleta, esquema: Esquema): ColorChip[] {
  const oscuro = esquema === 'oscuro'
  return [
    { fondo: colores.azulSuave, texto: colores.primario },
    oscuro ? { fondo: '#2A1F45', texto: '#B79CF0' } : { fondo: '#F1EAFD', texto: '#5B2DB0' },
    oscuro ? { fondo: '#123D45', texto: '#4FD1E0' } : { fondo: '#DDF6F8', texto: '#0B7F95' },
  ]
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : (partes[0] ?? '?').slice(0, 2)
  return letras.toUpperCase()
}

/** Fila de residente con avatar de iniciales. */
function FilaResidente({ nombre, secundario, indice, derecha }: { nombre: string; secundario: string; indice: number; derecha?: ReactNode }) {
  const styles = useEstilos(crearEstilos)
  const lista = avatares(useTema(), useApariencia().esquema)
  const c = lista[indice % lista.length]
  return (
    <View style={styles.residente}>
      <View style={[styles.avatar, { backgroundColor: c.fondo }]}>
        <Text style={[styles.avatarTexto, { color: c.texto }]}>{iniciales(nombre)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.residenteNombre}>{nombre}</Text>
        {secundario ? <Text style={styles.residenteSecundario}>{secundario}</Text> : null}
      </View>
      {derecha}
    </View>
  )
}

type Parte<T> = { datos: T; error?: undefined } | { datos?: undefined; error: string }

export default function Domicilio() {
  const router = useRouter()
  const styles = useEstilos(crearEstilos)
  const { domicilio } = useDomicilio()
  const id = domicilio?.id ?? null
  const principal = domicilio?.es_principal === true
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => setAviso(null), [id])

  const cargar = useCallback(
    async () => {
      if (id === null) throw new Error('Sin domicilio')
      const r = await Promise.allSettled([cargarCuotas(id), cargarPagos(id), cargarResidentes(id)])
      const fallo = r.find((x): x is PromiseRejectedResult => x.status === 'rejected' && debeCerrarSesion(x.reason))
      if (fallo) throw fallo.reason
      // Si todo falla, la pantalla muestra el error general; si falla una parte, solo esa sección.
      if (r.every((x) => x.status === 'rejected')) throw (r[0] as PromiseRejectedResult).reason
      const parte = <T,>(x: PromiseSettledResult<T>): Parte<T> =>
        x.status === 'fulfilled' ? { datos: x.value } : { error: mensajeDeCarga(x.reason) }
      return { cuotas: parte(r[0]), pagos: parte(r[1]), residentes: parte(r[2]) }
    },
    [id],
  )
  const { datos, error, cargando, refrescar, refrescando } = useCarga(id === null ? null : cargar)

  // Al volver a la pantalla (p. ej. tras "Agregar residente") se recarga; la primera vez ya cargó useCarga.
  const refrescarRef = useRef(refrescar)
  refrescarRef.current = refrescar
  const primeraVez = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (primeraVez.current) primeraVez.current = false
      else refrescarRef.current()
    }, []),
  )

  function confirmarQuitar(residenteId: number, nombre: string) {
    if (id === null) return
    Alert.alert('Quitar residente', `¿Quitar a ${nombre} de este domicilio? Perderá el acceso a la app.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          setAviso(null)
          try {
            await quitarResidente(id, residenteId)
            setAviso(`Se quitó a ${nombre}`)
            await refrescar()
          } catch (e) {
            setAviso(mensajeDeCarga(e))
          }
        },
      },
    ])
  }

  return (
    <Pantalla
      titulo="Domicilio"
      conLogo
      cabecera={<SelectorDomicilio />}
      cargando={cargando}
      error={error}
      onRefrescar={refrescar}
      refrescando={refrescando}
      testID="domicilio-scroll"
    >
      {datos && (
        <>
          <Seccion titulo="Cuotas" icono={Coins}>
            {datos.cuotas.error !== undefined ? (
              <Vacio texto={datos.cuotas.error} />
            ) : datos.cuotas.datos.length === 0 ? (
              <Vacio texto="No hay cuotas registradas." />
            ) : (
              datos.cuotas.datos.map((c) => (
                <View key={c.id} style={styles.cuota}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cuotaPeriodo}>{c.periodo ?? c.concepto ?? '—'}</Text>
                    <Text style={styles.residenteSecundario}>
                      {`${moneda(c.importe_cuota)}${c.fecha_vencimiento ? ` · vence ${fecha(c.fecha_vencimiento)}` : ''}`}
                    </Text>
                  </View>
                  <Estatus cuota={c} />
                </View>
              ))
            )}
          </Seccion>

          <Seccion titulo="Recibos" icono={ReceiptText}>
            {datos.pagos.error !== undefined ? (
              <Vacio texto={datos.pagos.error} />
            ) : datos.pagos.datos.length === 0 ? (
              <Vacio texto="Aún no hay pagos registrados." />
            ) : (
              datos.pagos.datos.map((p) => (
                <Fila
                  key={p.id}
                  principal={`${moneda(p.importe)} · ${p.concepto ?? 'Pago'}`}
                  secundario={fecha(p.fecha_pago)}
                  derecha={
                    p.tiene_recibo ? (
                      <Enlace texto="Ver" etiqueta={`Ver recibo ${p.id}`} onPress={() => router.push(`/recibo/${p.id}`)} />
                    ) : (
                      <Text style={styles.sinRecibo}>Sin recibo</Text>
                    )
                  }
                />
              ))
            )}
          </Seccion>

          <Seccion
            icono={Users}
            titulo={datos.residentes.error === undefined ? `Residentes · ${datos.residentes.datos.length}` : 'Residentes'}
            accion={
              principal ? (
                <Enlace
                  texto="+ Agregar"
                  onPress={() => router.push({ pathname: '/residentes/agregar', params: { domicilio: String(id) } })}
                />
              ) : undefined
            }
          >
            {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
            {datos.residentes.error !== undefined ? <Vacio texto={datos.residentes.error} /> : null}
            {(datos.residentes.datos ?? []).map((r, i) => (
              <FilaResidente
                key={r.id}
                indice={i}
                nombre={r.nombre}
                secundario={[r.es_principal ? 'Principal' : null, r.telefono, r.con_acceso ? null : 'Sin app']
                  .filter(Boolean)
                  .join(' · ')}
                derecha={
                  principal && !r.es_principal ? (
                    <Enlace texto="Quitar" peligro etiqueta={`Quitar a ${r.nombre}`} onPress={() => confirmarQuitar(r.id, r.nombre)} />
                  ) : undefined
                }
              />
            ))}
          </Seccion>
        </>
      )}
    </Pantalla>
  )
}

const crearEstilos = (colores: Paleta) =>
  StyleSheet.create({
    chip: { borderRadius: radio.pildora, paddingHorizontal: espacio.sm + 4, paddingVertical: 6 },
    chipTexto: { fontFamily: fuentes.textoFuerte, fontSize: 13 },
    cuota: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.sm,
      backgroundColor: colores.fondo,
      borderRadius: radio.lg,
      padding: espacio.md,
      marginTop: espacio.xs,
    },
    cuotaPeriodo: { fontFamily: fuentes.titulo, fontSize: 16, color: colores.navy },
    residente: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.md,
      paddingVertical: espacio.sm + 2,
      borderTopWidth: 1,
      borderTopColor: colores.borde,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarTexto: { fontFamily: fuentes.tituloFuerte, fontSize: 15 },
    residenteNombre: { fontFamily: fuentes.textoFuerte, fontSize: 16, color: colores.navy },
    residenteSecundario: { fontFamily: fuentes.texto, fontSize: 14, color: colores.secundario, marginTop: 2 },
    sinRecibo: { fontFamily: fuentes.texto, fontSize: 13, color: colores.secundario },
    aviso: { fontFamily: fuentes.textoMedio, fontSize: 14, color: colores.texto },
  })
