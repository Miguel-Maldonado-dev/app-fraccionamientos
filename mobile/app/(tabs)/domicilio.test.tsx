import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { respuesta, sesion, tablas } from '../../src/lib/test-utils'
import { router } from '../../src/lib/test-router'
import { SesionProvider } from '../../src/sesion'
import Domicilio from './domicilio'

jest.mock('../../src/lib/supabase')
jest.mock('expo-router', () => require('../../src/lib/test-router').mockRouter)
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const from = supabase.from as unknown as jest.Mock
const fetchMock = jest.fn()

const yo = (principal: boolean) => ({
  telefono: '3300000001',
  domicilios: [{ id: 12, direccion: 'Calle Demo 1', fraccionamiento: 'Fracc Demo', es_principal: principal, nombre: 'Ana' }],
})
const residentes = [
  { id: 1, nombre: 'Ana', telefono: '3300000001', es_principal: true, con_acceso: true },
  { id: 2, nombre: 'Beto', telefono: '3300000002', es_principal: false, con_acceso: true },
]

function servir(principal = true) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/app/yo')) return respuesta(200, yo(principal))
    if (url.endsWith('/residentes/2') && init?.method === 'DELETE') return new Response(null, { status: 204 })
    if (url.endsWith('/residentes')) return respuesta(200, residentes)
    return respuesta(404, { error: 'x' })
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  auth.getSession.mockResolvedValue(sesion('t'))
  from.mockImplementation(
    tablas({
      cuotas_info: [
        { id: 1, periodo: 'Nov 2026', concepto: 'Mantenimiento', importe_cuota: 1500, fecha_vencimiento: '2026-11-10', estatus_calculado: 'Vencido' },
      ],
      pagos_info: [
        { id: 7, fecha_pago: '2026-10-05', concepto: 'Mantenimiento', importe: 1500, metodo_pago: 'Efectivo', referencia: 'R-7', tiene_recibo: true },
        { id: 8, fecha_pago: '2026-09-05', concepto: 'Multa', importe: 200, metodo_pago: 'Efectivo', referencia: null, tiene_recibo: false },
      ],
    }),
  )
})

const montar = async () => {
  await render(
    <SesionProvider>
      <Domicilio />
    </SesionProvider>,
  )
  await screen.findByText('Beto')
}

test('cuotas con periodo, importe y estatus filtradas por domicilio', async () => {
  servir()
  await montar()
  expect(screen.getByText('Nov 2026')).toBeTruthy()
  expect(screen.getByText('Vencido')).toBeTruthy()
  expect(screen.getByText('$1,500.00 · vence 10 nov 2026')).toBeTruthy()
  expect(from).toHaveBeenCalledWith('cuotas_info')
  const q = from.mock.results[from.mock.calls.findIndex(([t]) => t === 'cuotas_info')].value
  expect(q.eq).toHaveBeenCalledWith('domicilio_id', 12)
})

test('cuota Cancelada se muestra con chip "Cancelada"', async () => {
  servir()
  from.mockImplementation(
    tablas({
      cuotas_info: [
        { id: 2, periodo: 'Dic 2026', concepto: 'Mantenimiento', importe_cuota: 1500, fecha_vencimiento: '2026-12-10', estatus_calculado: 'Cancelada' },
      ],
      pagos_info: [],
    }),
  )
  await montar()
  expect(screen.getByText('Cancelada')).toBeTruthy()
})

test('pago sin recibo no tiene "Ver"; con recibo abre la pantalla de recibo', async () => {
  servir()
  await montar()
  expect(screen.getAllByText('Ver')).toHaveLength(1)
  expect(screen.queryByLabelText('Ver recibo 8')).toBeNull()
  expect(screen.getByText('Sin recibo')).toBeTruthy()
  await fireEvent.press(screen.getByLabelText('Ver recibo 7'))
  expect(router.push).toHaveBeenCalledWith('/recibo/7')
})

test('residentes con cantidad', async () => {
  servir()
  await montar()
  expect(screen.getByText('Residentes · 2')).toBeTruthy()
})

test('no principal no ve agregar ni quitar', async () => {
  servir(false)
  await montar()
  expect(screen.queryByText('+ Agregar')).toBeNull()
  expect(screen.queryByText('Quitar')).toBeNull()
})

test('principal: agregar navega y quitar pide confirmación y llama DELETE', async () => {
  servir(true)
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await montar()
  await fireEvent.press(screen.getByText('+ Agregar'))
  expect(router.push).toHaveBeenCalledWith({ pathname: '/residentes/agregar', params: { domicilio: '12' } })
  expect(screen.queryByLabelText('Quitar a Ana')).toBeNull()
  await fireEvent.press(screen.getByLabelText('Quitar a Beto'))
  expect(alerta).toHaveBeenCalled()
  expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false)
  const botones = alerta.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
  await act(async () => botones.find((b) => b.text === 'Quitar')!.onPress!())
  const del = fetchMock.mock.calls.find(([, i]) => i?.method === 'DELETE')
  expect(del?.[0]).toMatch(/\/api\/app\/domicilios\/12\/residentes\/2$/)
  expect(await screen.findByText('Se quitó a Beto')).toBeTruthy()
})

test('error del servidor al quitar se muestra tal cual', async () => {
  servir(true)
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/app/yo')) return respuesta(200, yo(true))
    if (init?.method === 'DELETE') return respuesta(422, { error: 'No puedes quitarte a ti mismo' })
    return respuesta(200, residentes)
  })
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await montar()
  await fireEvent.press(screen.getByLabelText('Quitar a Beto'))
  const botones = alerta.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
  await act(async () => botones.find((b) => b.text === 'Quitar')!.onPress!())
  expect(await screen.findByText('No puedes quitarte a ti mismo')).toBeTruthy()
})

test('si falla residentes, cuotas y recibos siguen visibles', async () => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/api/app/yo')) return respuesta(200, yo(true))
    return respuesta(500, { error: 'boom' })
  })
  await render(
    <SesionProvider>
      <Domicilio />
    </SesionProvider>,
  )
  expect(await screen.findByText('Nov 2026')).toBeTruthy()
  expect(screen.getAllByText('Ver')).toHaveLength(1)
  expect(screen.getByText('Sin conexión, intenta de nuevo')).toBeTruthy()
  expect(screen.queryByText('Residentes · 0')).toBeNull()
})

test('el aviso "Se quitó a" se limpia al cambiar de domicilio', async () => {
  const dos = {
    telefono: '3300000001',
    domicilios: [
      { id: 12, direccion: 'Calle Demo 1', fraccionamiento: 'F', es_principal: true, nombre: 'Ana' },
      { id: 13, direccion: 'Calle Demo 2', fraccionamiento: 'F', es_principal: true, nombre: 'Ana' },
    ],
  }
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/app/yo')) return respuesta(200, dos)
    if (init?.method === 'DELETE') return new Response(null, { status: 204 })
    return respuesta(200, residentes)
  })
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await montar()
  await fireEvent.press(screen.getByLabelText('Quitar a Beto'))
  const botones = alerta.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]
  await act(async () => botones.find((b) => b.text === 'Quitar')!.onPress!())
  expect(await screen.findByText('Se quitó a Beto')).toBeTruthy()
  await fireEvent.press(screen.getByLabelText('Cambiar domicilio'))
  await fireEvent.press(screen.getByText('Calle Demo 2'))
  await screen.findByText('Beto')
  expect(screen.queryByText('Se quitó a Beto')).toBeNull()
})
