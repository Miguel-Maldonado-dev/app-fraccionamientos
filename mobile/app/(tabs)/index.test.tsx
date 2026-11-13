import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import * as SecureStore from 'expo-secure-store'
import { StyleSheet } from 'react-native'
import { AparienciaProvider } from '../../src/lib/apariencia'
import { supabase } from '../../src/lib/supabase'
import { respuesta, sesion } from '../../src/lib/test-utils'
import { SesionProvider } from '../../src/sesion'
import Inicio from './index'

jest.mock('../../src/lib/supabase')
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const fetchMock = jest.fn()

const boton = (id: number, extra: Partial<{ ancho_completo: boolean; habilitado: boolean; icono: string }> = {}) => ({
  id,
  orden: id,
  nombre: `Acceso ${id}`,
  icono: 'puerta',
  ancho_completo: false,
  habilitado: true,
  ...extra,
})
const estado = (over: object = {}) => ({
  domicilio: { id: 12, direccion: 'Calle Demo 1' },
  fraccionamiento: { nombre: 'Fracc Demo' },
  moroso: false,
  pin: '4839',
  botones: [boton(1), boton(2), boton(3)],
  ...over,
})
const yo = (n = 1) => ({
  telefono: '3300000001',
  domicilios: [
    { id: 12, direccion: 'Calle Demo 1', fraccionamiento: 'Fracc Demo', es_principal: true, nombre: 'Ana' },
    { id: 13, direccion: 'Calle Dos 2', fraccionamiento: 'Fracc Dos', es_principal: false, nombre: 'Ana B' },
  ].slice(0, n),
})

type Rutas = { yo?: unknown; estado?: (id: string) => Response; apertura?: () => Response | Promise<Response> }
function servir(r: Rutas = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/api/app/yo')) return respuesta(200, r.yo ?? yo())
    const m = url.match(/domicilios\/(\d+)\/(\w+)$/)
    if (m?.[2] === 'estado') return r.estado ? r.estado(m[1]) : respuesta(200, estado())
    if (m?.[2] === 'aperturas') return r.apertura ? r.apertura() : respuesta(200, { status: 'opened' })
    return respuesta(404, { error: 'x' })
  })
}
const llamadas = (parte: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(parte))

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue(sesion('t'))
})

const montar = async () => {
  await render(
    <SesionProvider>
      <Inicio />
    </SesionProvider>,
  )
  await screen.findByText('Acceso 1')
}
const ancho = (id: number) => StyleSheet.flatten(screen.getByTestId(`boton-${id}`).props.style).width
const fondo = (id: number) => StyleSheet.flatten(screen.getByTestId(`boton-${id}`).props.style).backgroundColor

test('saluda con el nombre y sin selector con un domicilio', async () => {
  servir()
  await montar()
  expect(await screen.findByText('Hola, Ana')).toBeTruthy()
  expect(screen.getByText('Calle Demo 1')).toBeTruthy()
  expect(screen.queryByTestId('selector-domicilio')).toBeNull()
  expect(llamadas('/residentes')).toHaveLength(0)
})

test('número impar de botones de mitad: el último ocupa todo el ancho', async () => {
  servir()
  await montar()
  expect(ancho(1)).toBe('48.5%')
  expect(ancho(2)).toBe('48.5%')
  expect(ancho(3)).toBe('100%')
})

test('botón deshabilitado en gris y no llama a la API', async () => {
  servir({ estado: () => respuesta(200, estado({ botones: [boton(1), boton(2, { habilitado: false })] })) })
  await montar()
  // Deshabilitado: gris #EEF2F6; sin `estilo` (servidor viejo): azul_claro #E6F1FD.
  expect(fondo(2)).toBe('#EEF2F6')
  expect(fondo(1)).toBe('#E6F1FD')
  await fireEvent.press(screen.getByTestId('boton-2'))
  expect(llamadas('aperturas')).toHaveLength(0)
})

test('doble toque: una sola apertura y muestra Abriendo…', async () => {
  let soltar!: (r: Response) => void
  servir({ apertura: () => new Promise<Response>((res) => (soltar = res)) })
  await montar()
  const b = screen.getByTestId('boton-1')
  await fireEvent.press(b)
  await fireEvent.press(b)
  expect(await screen.findByText('Abriendo…')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('boton-1'))
  expect(llamadas('aperturas')).toHaveLength(1)
  expect(JSON.parse(llamadas('aperturas')[0][1].body)).toEqual({ botonId: 1 })
  await act(async () => soltar(respuesta(200, { status: 'opened' })))
  expect(await screen.findByText('Abierto ✓')).toBeTruthy()
})

test('opened: Abierto ✓ con vibración y vuelve al nombre a los 2 s', async () => {
  servir()
  await montar()
  jest.useFakeTimers()
  try {
    await fireEvent.press(screen.getByTestId('boton-1'))
    expect(await screen.findByText('Abierto ✓')).toBeTruthy()
    expect(Haptics.impactAsync).toHaveBeenCalled()
    await act(async () => jest.advanceTimersByTime(2000))
    expect(screen.getByText('Acceso 1')).toBeTruthy()
  } finally {
    jest.useRealTimers()
  }
})

test.each(['denied', 'failed', 'timeout'])('%s: No se pudo abrir', async (status) => {
  servir({ apertura: () => respuesta(200, { status }) })
  await montar()
  await fireEvent.press(screen.getByTestId('boton-1'))
  expect(await screen.findByText('No se pudo abrir')).toBeTruthy()
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
})

test.each([
  [409, 'Tu domicilio tiene adeudos'],
  [422, 'Este acceso no está disponible'],
  [429, 'Demasiados intentos, espera un momento'],
  [502, 'No se pudo abrir, intenta de nuevo'],
])('error %i muestra el mensaje del servidor', async (codigo, mensaje) => {
  servir({ apertura: () => respuesta(codigo, { error: mensaje }) })
  await montar()
  await fireEvent.press(screen.getByTestId('boton-1'))
  expect(await screen.findByText(mensaje)).toBeTruthy()
})

test('moroso: aviso y Con adeudo', async () => {
  servir({
    estado: () => respuesta(200, estado({ moroso: true, botones: [boton(1, { habilitado: false })] })),
  })
  await montar()
  expect(screen.getByTestId('aviso-moroso')).toBeTruthy()
  expect(screen.getByText('Tu domicilio tiene adeudos. Los accesos remotos se reactivan al ponerte al corriente.')).toBeTruthy()
  expect(screen.getByText('Con adeudo')).toBeTruthy()
})

test('al corriente y PIN oculto que se muestra con el ojo', async () => {
  servir()
  await montar()
  expect(screen.getByText('Al corriente')).toBeTruthy()
  expect(screen.queryByTestId('aviso-moroso')).toBeNull()
  expect(screen.getByTestId('pin').props.children).toBe('••••')
  await fireEvent.press(screen.getByLabelText('Mostrar PIN'))
  expect(screen.getByTestId('pin').props.children).toBe('4839')
})

test('cambiar de domicilio recarga el estado', async () => {
  servir({
    yo: yo(2),
    estado: (id) =>
      respuesta(200, estado(id === '13' ? { domicilio: { id: 13, direccion: 'Calle Dos 2' }, botones: [boton(7)] } : {})),
  })
  await montar()
  await fireEvent.press(screen.getByTestId('selector-domicilio'))
  await fireEvent.press(screen.getAllByText('Calle Dos 2')[0])
  expect(await screen.findByText('Acceso 7')).toBeTruthy()
  expect(llamadas('/domicilios/13/estado')).toHaveLength(1)
})

test('jalar para actualizar vuelve a pedir el estado', async () => {
  servir()
  await montar()
  const antes = llamadas('/estado').length
  await act(async () => screen.getByTestId('inicio-scroll').props.refreshControl.props.onRefresh())
  expect(llamadas('/estado').length).toBe(antes + 1)
})

afterEach(async () => {
  await SecureStore.deleteItemAsync('apariencia')
})

test('modo oscuro: fondo #0A1424 y botón azul_claro #17304F', async () => {
  await SecureStore.setItemAsync('apariencia', 'oscuro')
  servir()
  await render(
    <AparienciaProvider>
      <SesionProvider>
        <Inicio />
      </SesionProvider>
    </AparienciaProvider>,
  )
  await screen.findByText('Acceso 1')
  await act(async () => {})
  expect(StyleSheet.flatten(screen.getByTestId('fondo-ondas').props.style).backgroundColor).toBe('#0A1424')
  expect(fondo(1)).toBe('#17304F')
})
