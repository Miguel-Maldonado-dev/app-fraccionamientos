import { _reiniciarDeviceId, obtenerDeviceId } from './dispositivo'

test('genera un UUID v4 una vez y lo reutiliza desde secure store', async () => {
  const a = await obtenerDeviceId()
  expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  _reiniciarDeviceId()
  expect(await obtenerDeviceId()).toBe(a)
})
