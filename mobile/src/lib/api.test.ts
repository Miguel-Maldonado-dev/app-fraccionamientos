import { alRechazarSesion, api, ApiError } from './api'
import { obtenerDeviceId } from './dispositivo'
import { supabase } from './supabase'
import { respuesta, sesion } from './test-utils'

jest.mock('./supabase')
const auth = supabase.auth as unknown as Record<string, jest.Mock>
const fetchMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test/'
  auth.getSession.mockResolvedValue(sesion('t1'))
})

test('agrega Authorization, X-Device-Id y X-Device-Name', async () => {
  fetchMock.mockResolvedValue(respuesta(200, { ok: 1 }))
  await expect(api('/api/app/yo')).resolves.toEqual({ ok: 1 })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('http://api.test/api/app/yo')
  const h = init.headers as Headers
  expect(h.get('Authorization')).toBe('Bearer t1')
  expect(h.get('X-Device-Id')).toBe(await obtenerDeviceId())
  expect(h.get('X-Device-Name')).toBe('iPhone de prueba')
})

test('en 401 renueva la sesión y reintenta una vez', async () => {
  fetchMock.mockResolvedValueOnce(respuesta(401, { error: 'No autorizado' })).mockResolvedValueOnce(respuesta(200, { ok: 2 }))
  auth.refreshSession.mockResolvedValue(sesion('t2'))
  await expect(api('/x')).resolves.toEqual({ ok: 2 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect((fetchMock.mock.calls[1][1].headers as Headers).get('Authorization')).toBe('Bearer t2')
})

test('401 tras renovar ⇒ ApiError 401 (sin más reintentos)', async () => {
  fetchMock.mockResolvedValue(respuesta(401, { error: 'No autorizado' }))
  auth.refreshSession.mockResolvedValue(sesion('t2'))
  await expect(api('/x')).rejects.toMatchObject({ status: 401, mensaje: 'No autorizado' })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('si la renovación falla no reintenta', async () => {
  fetchMock.mockResolvedValue(respuesta(401, { error: 'No autorizado' }))
  auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('x') })
  await expect(api('/x')).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('error de red ⇒ ApiError(0, Sin conexión)', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'))
  const e = await api('/x').catch((x) => x)
  expect(e).toBeInstanceOf(ApiError)
  expect(e).toMatchObject({ status: 0, mensaje: 'Sin conexión, intenta de nuevo' })
})

test('403 otro_dispositivo conserva el código', async () => {
  fetchMock.mockResolvedValue(respuesta(403, { error: 'Esta cuenta está ligada a otro dispositivo.', codigo: 'otro_dispositivo' }))
  await expect(api('/x')).rejects.toMatchObject({ status: 403, codigo: 'otro_dispositivo' })
})

test('409 ⇒ mensaje del servidor', async () => {
  fetchMock.mockResolvedValue(respuesta(409, { error: 'Ya existe' }))
  await expect(api('/x', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 409, mensaje: 'Ya existe' })
  expect((fetchMock.mock.calls[0][1].headers as Headers).get('Content-Type')).toBe('application/json')
})

describe('rechazo de sesión', () => {
  const manejador = jest.fn()
  let quitar: () => void
  beforeEach(() => {
    quitar = alRechazarSesion(manejador)
  })
  afterEach(() => quitar())

  test('401 tras renovar avisa al manejador', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { error: 'No autorizado' }))
    auth.refreshSession.mockResolvedValue(sesion('t2'))
    await expect(api('/x')).rejects.toMatchObject({ status: 401 })
    expect(manejador).toHaveBeenCalledTimes(1)
    expect(manejador.mock.calls[0][0]).toMatchObject({ status: 401 })
  })

  test('403 otro_dispositivo avisa al manejador', async () => {
    fetchMock.mockResolvedValue(respuesta(403, { error: 'x', codigo: 'otro_dispositivo' }))
    await expect(api('/x')).rejects.toMatchObject({ status: 403 })
    expect(manejador.mock.calls[0][0]).toMatchObject({ codigo: 'otro_dispositivo' })
  })

  test('401 que se resuelve al renovar no avisa', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(401, {})).mockResolvedValueOnce(respuesta(200, { ok: 1 }))
    auth.refreshSession.mockResolvedValue(sesion('t2'))
    await api('/x')
    expect(manejador).not.toHaveBeenCalled()
  })

  test('otros errores (403 sin código, 404, 500) no avisan', async () => {
    for (const r of [respuesta(403, { error: 'Solo el residente principal' }), respuesta(404, {}), respuesta(500, {})]) {
      fetchMock.mockResolvedValueOnce(r)
      await expect(api('/x')).rejects.toBeInstanceOf(ApiError)
    }
    expect(manejador).not.toHaveBeenCalled()
  })
})

test('204 ⇒ undefined', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  await expect(api('/x', { method: 'DELETE' })).resolves.toBeUndefined()
})
