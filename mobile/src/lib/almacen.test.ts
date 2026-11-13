import * as SecureStore from 'expo-secure-store'
import { almacenFragmentado } from './almacen'

const datos = (SecureStore as unknown as { __datos: Map<string, string> }).__datos

test('valor > 5000 bytes: fragmentos ≤ 1800, ida y vuelta y borrado', async () => {
  const valor = 'x'.repeat(2500) + 'ñ'.repeat(2600) + 'fin'
  await almacenFragmentado.setItem('sb-auth', valor)
  const claves = [...datos.keys()].filter((k) => k.startsWith('sb-auth.'))
  expect(claves.length).toBeGreaterThan(3)
  for (const k of claves) expect(datos.get(k)!.length).toBeLessThanOrEqual(1800)
  expect(await almacenFragmentado.getItem('sb-auth')).toBe(valor)
  await almacenFragmentado.setItem('sb-auth', 'corto')
  expect(await almacenFragmentado.getItem('sb-auth')).toBe('corto')
  await almacenFragmentado.removeItem('sb-auth')
  expect([...datos.keys()].filter((k) => k.startsWith('sb-auth.'))).toEqual([])
  expect(await almacenFragmentado.getItem('sb-auth')).toBeNull()
})
