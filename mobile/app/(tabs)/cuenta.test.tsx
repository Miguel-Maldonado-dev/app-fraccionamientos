import { fireEvent, render, screen } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { AparienciaProvider } from '../../src/lib/apariencia'
import { supabase } from '../../src/lib/supabase'
import { router } from '../../src/lib/test-router'
import { respuesta, sesion } from '../../src/lib/test-utils'
import { SesionProvider } from '../../src/sesion'
import Cuenta from './cuenta'

jest.mock('../../src/lib/supabase')
jest.mock('expo-router', () => require('../../src/lib/test-router').mockRouter)
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue(sesion('t'))
  fetchMock.mockResolvedValue(
    respuesta(200, {
      telefono: '3300000001',
      domicilios: [
        { id: 12, direccion: 'Calle Demo 1', fraccionamiento: 'Fracc Demo', es_principal: true, nombre: 'Ana' },
        { id: 13, direccion: 'Calle Dos 2', fraccionamiento: 'Fracc Dos', es_principal: false, nombre: 'Ana' },
      ],
    }),
  )
})

const montar = async () => {
  await render(
    <AparienciaProvider>
      <SesionProvider>
        <Cuenta />
      </SesionProvider>
    </AparienciaProvider>,
  )
  await screen.findByText('Calle Dos 2')
}

const abrirPassword = async () => {
  await montar()
  await fireEvent.press(screen.getByLabelText('Cambiar contraseña'))
}

test('cambiar contraseña inicia cerrada y se abre al tocarla', async () => {
  await montar()
  expect(screen.queryByTestId('nueva')).toBeNull()
  await fireEvent.press(screen.getByLabelText('Cambiar contraseña'))
  expect(screen.getByTestId('nueva')).toBeTruthy()
  await fireEvent.press(screen.getByLabelText('Cambiar contraseña'))
  expect(screen.queryByTestId('nueva')).toBeNull()
})

test('mis domicilios: cambia el seleccionado', async () => {
  await montar()
  expect(screen.getByTestId('seleccionado-12')).toBeTruthy()
  await fireEvent.press(screen.getByLabelText('Seleccionar Calle Dos 2'))
  expect(screen.getByTestId('seleccionado-13')).toBeTruthy()
  expect(screen.queryByTestId('seleccionado-12')).toBeNull()
})

test('contraseña corta rechazada sin llamar a updateUser', async () => {
  await abrirPassword()
  await fireEvent.changeText(screen.getByTestId('nueva'), 'corta')
  await fireEvent.changeText(screen.getByTestId('confirmar'), 'corta')
  await fireEvent.press(screen.getByTestId('guardar-password'))
  expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeTruthy()
  expect(auth.updateUser).not.toHaveBeenCalled()
})

test('contraseñas distintas rechazadas', async () => {
  await abrirPassword()
  await fireEvent.changeText(screen.getByTestId('nueva'), 'secreta123')
  await fireEvent.changeText(screen.getByTestId('confirmar'), 'secreta124')
  await fireEvent.press(screen.getByTestId('guardar-password'))
  expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy()
  expect(auth.updateUser).not.toHaveBeenCalled()
})

test('contraseña válida ⇒ updateUser', async () => {
  await abrirPassword()
  await fireEvent.changeText(screen.getByTestId('nueva'), 'secreta123')
  await fireEvent.changeText(screen.getByTestId('confirmar'), 'secreta123')
  await fireEvent.press(screen.getByTestId('guardar-password'))
  expect(auth.updateUser).toHaveBeenCalledWith({ password: 'secreta123' })
  expect(await screen.findByText('Contraseña actualizada')).toBeTruthy()
})

test('acerca de muestra la versión', async () => {
  await montar()
  expect(screen.getByText('Versión 1.2.3 (45)')).toBeTruthy()
})

test('cerrar sesión cierra en Supabase y vuelve al login', async () => {
  await montar()
  await fireEvent.press(screen.getByText('Cerrar sesión'))
  expect(auth.signOut).toHaveBeenCalled()
  expect(router.replace).toHaveBeenCalledWith('/login')
})

test('apariencia: tocar Oscuro guarda y queda seleccionada', async () => {
  await montar()
  expect(screen.getByRole('radio', { name: 'Automático' }).props.accessibilityState).toMatchObject({ selected: true })
  await fireEvent.press(screen.getByRole('radio', { name: 'Oscuro' }))
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('apariencia', 'oscuro')
  expect(screen.getByRole('radio', { name: 'Oscuro' }).props.accessibilityState).toMatchObject({ selected: true })
  expect(screen.getByRole('radio', { name: 'Automático' }).props.accessibilityState).toMatchObject({ selected: false })
})
