import { act, render, screen } from '@testing-library/react-native'
import { api } from './lib/api'
import { MENSAJE_OTRO_DISPOSITIVO, MENSAJE_SIN_ACCESO } from './lib/auth'
import { Text } from 'react-native'
import { supabase } from './lib/supabase'
import { respuesta, sesion } from './lib/test-utils'
import { SesionProvider, useSesion } from './sesion'

jest.mock('./lib/supabase')
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const fetchMock = jest.fn()

function Estado() {
  const { cargando, session, yo, errorInicio, aviso } = useSesion()
  return (
    <>
      <Text>{cargando ? 'cargando' : `s:${session ? 1 : 0} yo:${yo ? 1 : 0} e:${errorInicio ?? '-'}`}</Text>
      <Text testID="aviso">{aviso ?? '-'}</Text>
    </>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue(sesion('t'))
  auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('x') })
})

const montar = () => render(<SesionProvider><Estado /></SesionProvider>)

test('sin red al arrancar: conserva la sesión y muestra Sin conexión', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'))
  await montar()
  expect(await screen.findByText('s:1 yo:0 e:Sin conexión, intenta de nuevo')).toBeTruthy()
  expect(auth.signOut).not.toHaveBeenCalled()
})

test('500 al arrancar: conserva la sesión', async () => {
  fetchMock.mockResolvedValue(respuesta(500, { error: 'x' }))
  await montar()
  expect(await screen.findByText('s:1 yo:0 e:Sin conexión, intenta de nuevo')).toBeTruthy()
  expect(auth.signOut).not.toHaveBeenCalled()
})

test('401 al arrancar: cierra sesión', async () => {
  fetchMock.mockResolvedValue(respuesta(401, { error: 'No autorizado' }))
  await montar()
  await screen.findByText(/^s:/)
  expect(auth.signOut).toHaveBeenCalled()
})

test('403 otro_dispositivo al arrancar: cierra sesión', async () => {
  fetchMock.mockResolvedValue(respuesta(403, { error: 'x', codigo: 'otro_dispositivo' }))
  await montar()
  await screen.findByText(/^s:/)
  expect(auth.signOut).toHaveBeenCalled()
})

test('getSession lanza: termina de cargar sin sesión', async () => {
  auth.getSession.mockRejectedValue(new Error('storage'))
  await montar()
  expect(await screen.findByText('s:0 yo:0 e:-')).toBeTruthy()
})

test.each([
  [403, { error: 'x', codigo: 'otro_dispositivo' }, MENSAJE_OTRO_DISPOSITIVO],
  [401, { error: 'No autorizado' }, MENSAJE_SIN_ACCESO],
])('%i durante el uso normal: cierra sesión y deja el aviso', async (status, cuerpo, mensaje) => {
  fetchMock.mockResolvedValue(respuesta(200, { telefono: '3300000001', domicilios: [] }))
  await montar()
  expect(await screen.findByText('s:1 yo:1 e:-')).toBeTruthy()
  fetchMock.mockResolvedValue(respuesta(status, cuerpo))
  await act(async () => {
    await api('/api/app/domicilios/1/estado').catch(() => {})
  })
  expect(auth.signOut).toHaveBeenCalled()
  expect(screen.getByText('s:1 yo:0 e:-')).toBeTruthy()
  expect(screen.getByTestId('aviso').props.children).toBe(mensaje)
})
