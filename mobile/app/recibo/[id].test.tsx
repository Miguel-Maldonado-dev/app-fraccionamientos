import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as FS from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import * as Sharing from 'expo-sharing'
import { StyleSheet } from 'react-native'
import { AparienciaProvider } from '../../src/lib/apariencia'
import { supabase } from '../../src/lib/supabase'
import { params } from '../../src/lib/test-router'
import { sesion, tablas } from '../../src/lib/test-utils'
import Recibo from './[id]'

jest.mock('../../src/lib/supabase')
jest.mock('expo-router', () => require('../../src/lib/test-router').mockRouter)
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const from = supabase.from as unknown as jest.Mock
const fetchMock = jest.fn()
const escritos = (FS as unknown as { __escritos: { uri: string; bytes: Uint8Array }[] }).__escritos

const pago = { id: 7, fecha_pago: '2026-10-05', concepto: 'Mantenimiento', importe: 1500, metodo_pago: 'Efectivo', referencia: 'R-7', tiene_recibo: true }

beforeEach(() => {
  jest.clearAllMocks()
  escritos.length = 0
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue(sesion('t'))
  params.current = { id: '7' }
})

test('muestra los datos y comparte el PDF descargado con headers', async () => {
  from.mockImplementation(tablas({ pagos_info: [pago] }))
  fetchMock.mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
  await render(<Recibo />)
  expect(await screen.findByText('$1,500.00')).toBeTruthy()
  expect(screen.getByText('R-7')).toBeTruthy()
  expect(screen.getByText('5 oct 2026')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('compartir-pdf'))
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/api\/app\/pagos\/7\/recibo$/)
  expect((init.headers as Headers).get('Authorization')).toBe('Bearer t')
  expect((init.headers as Headers).get('X-Device-Id')).toBeTruthy()
  expect(escritos[0].uri).toBe('file:///cache/recibo-7.pdf')
  expect(Array.from(escritos[0].bytes)).toEqual([37, 80, 68, 70])
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/recibo-7.pdf', expect.objectContaining({ mimeType: 'application/pdf' }))
})

test('404 del recibo muestra el mensaje del servidor', async () => {
  from.mockImplementation(tablas({ pagos_info: [pago] }))
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Recibo no disponible' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))
  await render(<Recibo />)
  await fireEvent.press(await screen.findByTestId('compartir-pdf'))
  expect(await screen.findByText('Recibo no disponible')).toBeTruthy()
  expect(Sharing.shareAsync).not.toHaveBeenCalled()
})

test('pago sin recibo no ofrece compartir', async () => {
  from.mockImplementation(tablas({ pagos_info: [{ ...pago, tiene_recibo: false }] }))
  await render(<Recibo />)
  expect(await screen.findByText('Este pago no tiene recibo.')).toBeTruthy()
  expect(screen.queryByTestId('compartir-pdf')).toBeNull()
})

test('omite la fila Referencia cuando es nula', async () => {
  from.mockImplementation(tablas({ pagos_info: [{ ...pago, referencia: null }] }))
  await render(<Recibo />)
  expect(await screen.findByText('Concepto')).toBeTruthy()
  expect(screen.getByText('Método de pago')).toBeTruthy()
  expect(screen.queryByText('Referencia')).toBeNull()
})

afterEach(async () => {
  await SecureStore.deleteItemAsync('apariencia')
})

test('modo oscuro: fondo #0A1424', async () => {
  await SecureStore.setItemAsync('apariencia', 'oscuro')
  from.mockImplementation(tablas({ pagos_info: [pago] }))
  await render(
    <AparienciaProvider>
      <Recibo />
    </AparienciaProvider>,
  )
  await screen.findByText('$1,500.00')
  await act(async () => {})
  expect(StyleSheet.flatten(screen.getByTestId('fondo-ondas').props.style).backgroundColor).toBe('#0A1424')
})
