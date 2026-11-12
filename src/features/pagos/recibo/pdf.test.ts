// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { ReciboDatos } from './datos'
import { cargarLogo } from './logo'
import { generarReciboPdf, medirRecibo } from './pdf'

vi.mock('server-only', () => ({}))

const datos: ReciboDatos = {
  v: 1,
  fraccionamiento: 'Lago Amadeo',
  direccion: 'Calle 1 #2',
  residente: 'Ana Pérez',
  concepto: 'Cuota mensual',
  fechaPago: '05/01/2026',
  subtotal: 500,
  total: 500,
}
const REF = '3f2b8c1e-0000-4000-8000-123456789abc'
// PNG 1x1
const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const SIN_COMPRIMIR = { comprimir: false }
const texto = (b: Uint8Array) => new TextDecoder('latin1').decode(b)
const cuenta = (s: string, sub: string) => s.split(sub).length - 1

describe('generarReciboPdf', () => {
  it('empieza con %PDF y contiene los textos fijos', async () => {
    const t = texto(await generarReciboPdf(datos, REF, null, SIN_COMPRIMIR))
    expect(t.startsWith('%PDF')).toBe(true)
    expect(t).toContain('RECIBO DE PAGO')
    expect(t).toContain('Lago Amadeo')
    expect(t).toContain('TOTAL')
  })
  it('muestra recargo y descuento solo si existen', async () => {
    const con = texto(await generarReciboPdf({ ...datos, recargo: 50, descuento: 20 }, REF, null, SIN_COMPRIMIR))
    expect(con).toContain('+ Recargo')
    expect(con).toContain('- Descuento')
    const sin = texto(await generarReciboPdf(datos, REF, null, SIN_COMPRIMIR))
    expect(sin).not.toContain('+ Recargo')
    expect(sin).not.toContain('- Descuento')
  })
  it('una dirección larga no lanza y alarga la página', async () => {
    const larga = { ...datos, direccion: 'Avenida Siempre Viva '.repeat(7).slice(0, 140) }
    await expect(generarReciboPdf(larga, REF, null, SIN_COMPRIMIR)).resolves.toBeInstanceOf(Uint8Array)
    expect(medirRecibo(larga, true)).toBeGreaterThan(medirRecibo(datos, true))
  })
  it('con logo incluye más imágenes', async () => {
    const con = cuenta(texto(await generarReciboPdf(datos, REF, LOGO, SIN_COMPRIMIR)), '/Subtype /Image')
    const sin = cuenta(texto(await generarReciboPdf(datos, REF, null, SIN_COMPRIMIR)), '/Subtype /Image')
    expect(con).toBeGreaterThan(sin)
  })
  it('por defecto comprime: empieza con %PDF y pesa menos que sin comprimir', async () => {
    const comprimido = await generarReciboPdf(datos, REF, LOGO)
    const plano = await generarReciboPdf(datos, REF, LOGO, SIN_COMPRIMIR)
    expect(texto(comprimido).startsWith('%PDF')).toBe(true)
    expect(comprimido.length).toBeLessThan(plano.length)
  })
  it('con el logotipo real y opciones por defecto pesa menos de 40 KB', async () => {
    const logo = await cargarLogo()
    expect(logo).not.toBeNull()
    const bytes = await generarReciboPdf(datos, REF, logo)
    expect(bytes.length).toBeLessThan(40_000)
  })
})
