import { fireEvent, render, screen } from '@testing-library/react-native'
import { supabase } from '../../src/lib/supabase'
import { params } from '../../src/lib/test-router'
import { respuesta, sesion } from '../../src/lib/test-utils'
import AgregarResidente from './agregar'

jest.mock('../../src/lib/supabase')
jest.mock('expo-router', () => require('../../src/lib/test-router').mockRouter)
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue(sesion('t'))
  params.current = { domicilio: '12' }
})

async function llenar(password = '') {
  await render(<AgregarResidente />)
  await fireEvent.changeText(screen.getByTestId('nombre'), ' Ana Pérez ')
  await fireEvent.changeText(screen.getByTestId('telefono'), '3311112222')
  if (password) await fireEvent.changeText(screen.getByTestId('password'), password)
  await fireEvent.press(screen.getByTestId('agregar'))
}

test('cuentaCreada:false ⇒ "Se vinculó la cuenta existente" (sin contraseña en el cuerpo)', async () => {
  fetchMock.mockResolvedValue(respuesta(201, { id: 9, cuentaCreada: false }))
  await llenar()
  expect(await screen.findByText('Se vinculó la cuenta existente')).toBeTruthy()
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/api\/app\/domicilios\/12\/residentes$/)
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ nombre: 'Ana Pérez', telefono: '3311112222' })
})

test('cuentaCreada:true ⇒ mensaje de cuenta creada', async () => {
  fetchMock.mockResolvedValue(respuesta(201, { id: 9, cuentaCreada: true }))
  await llenar('secreta123')
  expect(await screen.findByText('Residente agregado')).toBeTruthy()
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).password).toBe('secreta123')
})

test('error del servidor tal cual', async () => {
  const msg = 'Este domicilio ya tiene el máximo de 4 residentes con acceso a la app'
  fetchMock.mockResolvedValue(respuesta(422, { error: msg }))
  await llenar()
  expect(await screen.findByText(msg)).toBeTruthy()
  expect(screen.getByTestId('agregar')).toBeTruthy()
})
