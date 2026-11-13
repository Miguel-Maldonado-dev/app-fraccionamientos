import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { Pressable, Text } from 'react-native'
import * as RN from 'react-native'
import { AparienciaProvider, useApariencia, useTema } from './apariencia'
import { paletaOscura } from './tema'

const get = SecureStore.getItemAsync as jest.Mock
const set = SecureStore.setItemAsync as jest.Mock
let sistema: 'light' | 'dark' | null = 'light'

beforeEach(() => {
  jest.clearAllMocks()
  ;(SecureStore as unknown as { __datos: Map<string, string> }).__datos.clear()
  sistema = 'light'
  jest.spyOn(RN, 'useColorScheme').mockImplementation(() => sistema)
})
afterEach(() => jest.restoreAllMocks())

function Sonda() {
  const { preferencia, esquema, setPreferencia } = useApariencia()
  const c = useTema()
  return (
    <Pressable testID="claro" onPress={() => setPreferencia('claro')}>
      <Text testID="estado">{`${preferencia}|${esquema}|${c.fondo}`}</Text>
    </Pressable>
  )
}
const montar = () => render(<AparienciaProvider><Sonda /></AparienciaProvider>)
const estado = () => screen.getByTestId('estado').props.children as string

test("lee 'oscuro' guardado", async () => {
  await SecureStore.setItemAsync('apariencia', 'oscuro')
  await montar()
  await waitFor(() => expect(estado()).toBe(`oscuro|oscuro|${paletaOscura.fondo}`))
})

test("valor inválido ⇒ 'auto'", async () => {
  await SecureStore.setItemAsync('apariencia', 'rojo')
  await montar()
  await act(async () => {})
  expect(estado()).toBe('auto|claro|#F5F8FC')
})

test("error de lectura ⇒ 'auto' sin crashear", async () => {
  get.mockRejectedValueOnce(new Error('falla'))
  await montar()
  await act(async () => {})
  expect(estado().startsWith('auto|claro')).toBe(true)
})

test("'auto' sigue el esquema del sistema", async () => {
  sistema = 'dark'
  const r = await montar()
  await act(async () => {})
  expect(estado()).toBe(`auto|oscuro|${paletaOscura.fondo}`)
  sistema = 'light'
  await r.rerender(<AparienciaProvider><Sonda /></AparienciaProvider>)
  expect(estado()).toBe('auto|claro|#F5F8FC')
})

test("setPreferencia('claro') guarda en SecureStore", async () => {
  sistema = 'dark'
  await montar()
  await act(async () => {})
  await fireEvent.press(screen.getByTestId('claro'))
  expect(set).toHaveBeenCalledWith('apariencia', 'claro')
  expect(estado()).toBe('claro|claro|#F5F8FC')
})

test('elegir antes de que termine la lectura ignora el valor leído tarde', async () => {
  let resolver: (v: string | null) => void = () => {}
  get.mockImplementationOnce(() => new Promise<string | null>((r) => (resolver = r)))
  await montar()
  await fireEvent.press(screen.getByTestId('claro'))
  await act(async () => resolver('oscuro'))
  expect(estado()).toBe('claro|claro|#F5F8FC')
  expect(set).toHaveBeenCalledWith('apariencia', 'claro')
})
