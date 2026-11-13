import { fireEvent, render, screen } from '@testing-library/react-native'
import { supabase } from '../src/lib/supabase'
import { respuesta, sesion } from '../src/lib/test-utils'
import { SesionProvider } from '../src/sesion'
import Login from './login'

jest.mock('../src/lib/supabase')
jest.mock('expo-router', () => ({ Redirect: () => null }))
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
})

async function intentar(tel = '33 0000 0001', pass = 'residente123') {
  await render(
    <SesionProvider>
      <Login />
    </SesionProvider>,
  )
  await fireEvent.changeText(await screen.findByTestId('telefono'), tel)
  await fireEvent.changeText(screen.getByTestId('password'), pass)
  await fireEvent.press(screen.getByTestId('entrar'))
}

test('credenciales inválidas', async () => {
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: { status: 400, message: 'Invalid login credentials' } })
  await intentar()
  expect(await screen.findByText('Teléfono o contraseña incorrectos')).toBeTruthy()
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: '3300000001@auth.internal', password: 'residente123' })
})

test('teléfono inválido no llama a Supabase', async () => {
  await intentar('123')
  expect(await screen.findByText('Teléfono o contraseña incorrectos')).toBeTruthy()
  expect(auth.signInWithPassword).not.toHaveBeenCalled()
})

test('/yo 401 ⇒ cierra sesión y muestra sin acceso', async () => {
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null }).mockResolvedValue(sesion('t'))
  auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('x') })
  fetchMock.mockResolvedValue(respuesta(401, { error: 'No autorizado' }))
  await intentar()
  expect(
    await screen.findByText('Tu cuenta no tiene acceso a la app. Contacta a la administración.'),
  ).toBeTruthy()
  expect(auth.signOut).toHaveBeenCalled()
})

test('/yo 403 otro_dispositivo ⇒ cierra sesión y muestra mensaje de dispositivo', async () => {
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null }).mockResolvedValue(sesion('t'))
  fetchMock.mockResolvedValue(
    respuesta(403, { error: 'Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue.', codigo: 'otro_dispositivo' }),
  )
  await intentar()
  expect(
    await screen.findByText('Esta cuenta está ligada a otro dispositivo. Pide a la administración que la desligue.'),
  ).toBeTruthy()
  expect(auth.signOut).toHaveBeenCalled()
})

test('éxito ⇒ sin mensaje de error', async () => {
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null }).mockResolvedValue(sesion('t'))
  fetchMock.mockResolvedValue(respuesta(200, { telefono: '3300000001', domicilios: [] }))
  await intentar()
  await screen.findByTestId('entrar')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).toBeNull()
})

test.each([
  [429, 'Demasiados intentos, espera un momento'],
  [500, 'Ocurrió un error, intenta de nuevo'],
  [0, 'Sin conexión, intenta de nuevo'],
])('signIn status %i ⇒ %s', async (status, mensaje) => {
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: { status, message: 'x' } })
  await intentar()
  expect(await screen.findByText(mensaje)).toBeTruthy()
})

test('¿Olvidaste tu contraseña? muestra aviso y no inicia sesión', async () => {
  await render(
    <SesionProvider>
      <Login />
    </SesionProvider>,
  )
  await fireEvent.press(await screen.findByText('¿Olvidaste tu contraseña?'))
  expect(screen.getByText('Pide a la administración que restablezca tu contraseña.')).toBeTruthy()
  expect(auth.signInWithPassword).not.toHaveBeenCalled()
  expect(screen.getByTestId('entrar')).toBeTruthy()
})
