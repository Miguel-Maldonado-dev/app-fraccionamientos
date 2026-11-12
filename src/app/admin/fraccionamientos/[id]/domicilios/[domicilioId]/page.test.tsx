import { render, screen } from '@testing-library/react'

const requireSuperAdminPage = vi.fn()
const getFraccionamiento = vi.fn()
const getDomicilioConsola = vi.fn()
const getPermisoDomicilio = vi.fn()
const estadoDeEntidades = vi.fn()
const estadoDomicilio = vi.fn()
const listControles = vi.fn()
const listBotonesConfigurados = vi.fn()
const getPinDomicilio = vi.fn()
const domicilioSincronizado = vi.fn()
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('@/lib/auth/require-super-admin-page', () => ({ requireSuperAdminPage: () => requireSuperAdminPage() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))
vi.mock('@/features/fraccionamientos/queries', () => ({
  getFraccionamiento: (...a: unknown[]) => getFraccionamiento(...a),
}))
vi.mock('@/features/domicilios/queries', () => ({
  getDomicilioConsola: (...a: unknown[]) => getDomicilioConsola(...a),
  getPermisoDomicilio: (...a: unknown[]) => getPermisoDomicilio(...a),
}))
vi.mock('@/features/sincronizacion/queries', () => ({
  estadoDeEntidades: (...a: unknown[]) => estadoDeEntidades(...a),
  estadoDomicilio: (...a: unknown[]) => estadoDomicilio(...a),
}))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))
vi.mock('@/features/sincronizacion/actions', () => ({
  reintentarTarea: vi.fn(),
  reintentarTareaEnFraccionamiento: vi.fn(),
}))
vi.mock('@/features/accesos/queries', () => ({
  listTelefonos: vi.fn().mockResolvedValue([]),
  listTarjetas: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/controles/actions', () => ({
  crearControl: vi.fn(),
  actualizarControl: vi.fn(),
  eliminarControl: vi.fn(),
}))
vi.mock('@/features/pin/actions', () => ({
  fijarPinDomicilio: vi.fn(),
  generarPinDomicilio: vi.fn(),
  quitarPinDomicilio: vi.fn(),
}))
vi.mock('@/features/controles/queries', () => ({
  listControles: (...a: unknown[]) => listControles(...a),
  listBotonesConfigurados: (...a: unknown[]) => listBotonesConfigurados(...a),
}))
vi.mock('@/features/pin/queries', () => ({
  getPinDomicilio: (...a: unknown[]) => getPinDomicilio(...a),
  domicilioSincronizado: (...a: unknown[]) => domicilioSincronizado(...a),
}))
vi.mock('@/features/residentes/queries', () => ({ listResidentesDomicilio: vi.fn().mockResolvedValue([]) }))
vi.mock('@/features/fraccionamientos/operacion-actions', () => ({
  actualizarDomicilioEnFraccionamiento: vi.fn(),
  crearResidenteEnFraccionamiento: vi.fn(),
  actualizarResidenteEnFraccionamiento: vi.fn(),
  eliminarResidenteEnFraccionamiento: vi.fn(),
  crearTelefonoEnFraccionamiento: vi.fn(),
  actualizarTelefonoEnFraccionamiento: vi.fn(),
  eliminarTelefonoEnFraccionamiento: vi.fn(),
  crearTarjetaEnFraccionamiento: vi.fn(),
  actualizarTarjetaEnFraccionamiento: vi.fn(),
  eliminarTarjetaEnFraccionamiento: vi.fn(),
  crearControlEnFraccionamiento: vi.fn(),
  actualizarControlEnFraccionamiento: vi.fn(),
  eliminarControlEnFraccionamiento: vi.fn(),
  fijarPinDomicilioEnFraccionamiento: vi.fn(),
  generarPinDomicilioEnFraccionamiento: vi.fn(),
  quitarPinDomicilioEnFraccionamiento: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))

import DomicilioConsolaPage from './page'

const domicilio = {
  id: 8,
  direccion: 'LAGO UNO 12',
  fecha_alta: '2026-01-05',
  observaciones: null,
  residente_principal: 'Ana',
  id_concepto: 3,
  tipo_cuota: 'Completa',
  medios: ['tarjeta', 'telefono'],
  estatus: null,
  fraccionamientoId: 5,
}
const props = (id: string, domicilioId: string) => ({ params: Promise.resolve({ id, domicilioId }) })

describe('detalle de domicilio en la consola', () => {
  beforeEach(() => {
    requireSuperAdminPage.mockReset().mockResolvedValue(undefined)
    getFraccionamiento.mockReset().mockResolvedValue({ id: 5, nombre: 'Los Pinos' })
    getDomicilioConsola.mockReset().mockResolvedValue(domicilio)
    getPermisoDomicilio.mockReset().mockResolvedValue(null)
    estadoDeEntidades.mockReset().mockResolvedValue(new Map())
    estadoDomicilio.mockReset().mockResolvedValue(null)
    listControles.mockReset().mockResolvedValue([])
    listBotonesConfigurados.mockReset().mockResolvedValue([])
    getPinDomicilio.mockReset().mockResolvedValue(null)
    domicilioSincronizado.mockReset().mockResolvedValue(false)
    notFound.mockClear()
  })

  it('exige super admin (un tesorero recibe notFound) antes de leer', async () => {
    requireSuperAdminPage.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(DomicilioConsolaPage(props('5', '8'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getDomicilioConsola).not.toHaveBeenCalled()
  })

  it.each([
    ['abc', '8'],
    ['5', '0'],
    ['5', '8x'],
  ])('ids %s/%s no válidos → notFound()', async (id, did) => {
    await expect(DomicilioConsolaPage(props(id, did))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getDomicilioConsola).not.toHaveBeenCalled()
  })

  it('domicilio inexistente → notFound()', async () => {
    getDomicilioConsola.mockResolvedValue(null)
    await expect(DomicilioConsolaPage(props('5', '8'))).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('domicilio de otro fraccionamiento con la URL de este → notFound()', async () => {
    getDomicilioConsola.mockResolvedValue({ ...domicilio, fraccionamientoId: 6 })
    await expect(DomicilioConsolaPage(props('5', '8'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('fraccionamiento inexistente → notFound()', async () => {
    getFraccionamiento.mockResolvedValue(null)
    await expect(DomicilioConsolaPage(props('5', '8'))).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('muestra accesos y residentes, sin cuotas ni pagos ni estatus', async () => {
    render(await DomicilioConsolaPage(props('5', '8')))
    expect(screen.getByRole('heading', { level: 1, name: 'LAGO UNO 12' })).toBeInTheDocument()
    expect(screen.getByText('Números de acceso')).toBeInTheDocument()
    expect(screen.getByText('Tarjetas de acceso')).toBeInTheDocument()
    expect(screen.getByText('Residentes')).toBeInTheDocument()
    expect(screen.queryByText('Cuotas')).not.toBeInTheDocument()
    expect(screen.queryByText('Pagos extra')).not.toBeInTheDocument()
    expect(screen.queryByText('Estatus')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver/ })).toHaveAttribute('href', '/admin/fraccionamientos/5?tab=domicilios')
    expect(screen.getByRole('link', { name: 'Los Pinos' })).toHaveAttribute('href', '/admin/fraccionamientos/5')
    expect(screen.getByRole('button', { name: 'Editar domicilio' })).toBeInTheDocument()
  })

  it('nunca muestra el permiso (revelaría si el domicilio es moroso); sí el estado de sincronización', async () => {
    // Aunque el perfil asignado fuera el moroso (p-mor, "Morosos"), la consola no lo consulta ni lo muestra.
    getPermisoDomicilio.mockResolvedValue({ nombre: 'Morosos', pendiente: false })
    estadoDomicilio.mockResolvedValue({ estado: 'ok', error: null, tareaId: 't1' })
    render(await DomicilioConsolaPage(props('5', '8')))
    expect(getPermisoDomicilio).not.toHaveBeenCalled()
    expect(screen.queryByText(/Permiso/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Morosos/)).not.toBeInTheDocument()
    expect(estadoDomicilio).toHaveBeenCalledWith(expect.anything(), 5, 8, { consola: true })
    expect(estadoDeEntidades).toHaveBeenCalledWith(expect.anything(), 5, 'tarjeta', [])
    expect(screen.getByText('Sincronizado')).toBeInTheDocument()
  })

  it('muestra controles y PIN (el super admin ve los dígitos) con los datos de ese fraccionamiento', async () => {
    getDomicilioConsola.mockResolvedValue({ ...domicilio, medios: ['control', 'pin'] })
    listControles.mockResolvedValue([
      {
        id: 41,
        domicilio_id: 8,
        fraccionamiento_id: 5,
        control_id: 'c1',
        descripcion: 'Portón',
        botones: [{ boton: 0, rf_code: 9, boton_id: null }],
        created_at: '2026-11-11',
      },
    ])
    listBotonesConfigurados.mockResolvedValue([0])
    getPinDomicilio.mockResolvedValue('4821')
    domicilioSincronizado.mockResolvedValue(true)
    render(await DomicilioConsolaPage(props('5', '8')))
    expect(listBotonesConfigurados).toHaveBeenCalledWith(expect.anything(), 5)
    expect(estadoDeEntidades).toHaveBeenCalledWith(expect.anything(), 5, 'control', [41])
    expect(screen.getByText('Controles')).toBeInTheDocument()
    expect(screen.getByText('Portón')).toBeInTheDocument()
    expect(screen.getByText('4821')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar' })).toBeEnabled()
  })
})
