import { fireEvent, render, screen } from '@testing-library/react-native'
import { supabase } from '../../src/lib/supabase'
import { respuesta, sesion, tablas } from '../../src/lib/test-utils'
import { SesionProvider } from '../../src/sesion'
import Accesos from './accesos'

jest.mock('../../src/lib/supabase')
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const from = supabase.from as unknown as jest.Mock
const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue(sesion('t'))
  fetchMock.mockResolvedValue(
    respuesta(200, {
      telefono: '3300000001',
      domicilios: [{ id: 12, direccion: 'Calle Demo 1', fraccionamiento: 'Fracc Demo', es_principal: false, nombre: 'Ana' }],
    }),
  )
})

test('muestra tarjetas, controles, PIN oculto y teléfonos del domicilio', async () => {
  from.mockImplementation(
    tablas({
      tarjetas_acceso: [{ id: 1, numero: '0012345', descripcion: 'Auto rojo' }],
      controles_acceso: [{ id: 2, control_id: 'C-99', descripcion: 'Control cochera' }],
      pines_acceso: [{ pin: '4839' }],
      telefonos_acceso: [{ id: 3, telefono: '3311112222' }],
    }),
  )
  await render(
    <SesionProvider>
      <Accesos />
    </SesionProvider>,
  )
  expect(await screen.findByText('0012345')).toBeTruthy()
  expect(screen.getByText('Auto rojo')).toBeTruthy()
  expect(screen.getByText('Control cochera')).toBeTruthy()
  expect(screen.getByText('33 1111 2222')).toBeTruthy()
  expect(screen.getByTestId('pin-accesos').props.children).toBe('••••')
  await fireEvent.press(screen.getByLabelText('Mostrar PIN'))
  expect(screen.getByTestId('pin-accesos').props.children).toBe('4839')
  const tablasPedidas = from.mock.calls.map(([t]) => t)
  expect(tablasPedidas).toEqual(expect.arrayContaining(['tarjetas_acceso', 'controles_acceso', 'pines_acceso', 'telefonos_acceso']))
  for (const r of from.mock.results) expect(r.value.eq).toHaveBeenCalledWith('domicilio_id', 12)
})

test('sin registros muestra vacíos', async () => {
  from.mockImplementation(tablas({}))
  await render(
    <SesionProvider>
      <Accesos />
    </SesionProvider>,
  )
  expect(await screen.findByText('Sin tarjetas registradas.')).toBeTruthy()
  expect(screen.getByText('Este domicilio no tiene PIN.')).toBeTruthy()
})
