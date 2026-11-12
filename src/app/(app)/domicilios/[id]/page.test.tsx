import { render } from '@testing-library/react'

const getCurrentUser = vi.fn()
const getPinDomicilio = vi.fn()
const domicilioSincronizado = vi.fn()
const listControles = vi.fn()
const listBotonesConfigurados = vi.fn()
const estadoDeEntidades = vi.fn()
const getDomicilioInfo = vi.fn()
const getEstadoAccesoDomicilio = vi.fn()
const AccesoForzado = vi.fn<(props: Record<string, unknown>) => null>(() => null)
const AccesosSection = vi.fn<(props: Record<string, unknown>) => null>(() => null)
const { vacio, nada } = vi.hoisted(() => ({
  vacio: () => vi.fn().mockResolvedValue([]),
  nada: () => null,
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: () => getCurrentUser() }))
vi.mock('@/features/accesos/components/accesos-section', () => ({
  AccesosSection: (p: Record<string, unknown>) => AccesosSection(p),
}))
vi.mock('@/features/accesos/components/sync-estado', () => ({ SyncEstado: nada }))
vi.mock('@/features/accesos/queries', () => ({ listTelefonos: vacio(), listTarjetas: vacio() }))
vi.mock('@/features/controles/queries', () => ({
  listControles: (...a: unknown[]) => listControles(...a),
  listBotonesConfigurados: (...a: unknown[]) => listBotonesConfigurados(...a),
}))
vi.mock('@/features/pin/queries', () => ({
  getPinDomicilio: (...a: unknown[]) => getPinDomicilio(...a),
  domicilioSincronizado: (...a: unknown[]) => domicilioSincronizado(...a),
}))
vi.mock('@/features/catalogos/queries', () => ({ listTiposCuota: vacio() }))
vi.mock('@/features/cuotas/components/cuotas-section', () => ({ CuotasSection: nada }))
vi.mock('@/features/cuotas/queries', () => ({
  listAnios: vacio(),
  listConceptosDescuento: vacio(),
  listConceptosRecargo: vacio(),
  listCuotasDomicilio: vacio(),
  listMeses: vacio(),
}))
vi.mock('@/features/domicilios/components/acceso-forzado', () => ({ AccesoForzado: (p: Record<string, unknown>) => AccesoForzado(p) }))
vi.mock('@/features/domicilios/components/domicilio-info-card', () => ({ DomicilioInfoCard: nada }))
vi.mock('@/features/domicilios/components/edit-domicilio-dialog', () => ({ EditDomicilioDialog: nada }))
vi.mock('@/features/domicilios/queries', () => ({
  getDomicilioConcepto: vi.fn().mockResolvedValue(null),
  getDomicilioInfo: (...a: unknown[]) => getDomicilioInfo(...a),
  getEstadoAccesoDomicilio: (...a: unknown[]) => getEstadoAccesoDomicilio(...a),
  getPermisoDomicilio: vi.fn().mockResolvedValue(null),
  listConceptosRecurrentes: vacio(),
  listDomiciliosOptions: vacio(),
}))
vi.mock('@/features/pagos/components/pagos-extra-section', () => ({ PagosExtraSection: nada }))
vi.mock('@/features/pagos/components/recibo-por-cuota', () => ({ ReciboPorCuota: nada }))
vi.mock('@/features/pagos/components/registrar-pago-cuota-dialog', () => ({ RegistrarPagoCuotaDialog: nada }))
vi.mock('@/features/pagos/queries', () => ({
  listConceptosExtra: vacio(),
  listMetodosPago: vacio(),
  listPagosExtraDomicilio: vacio(),
}))
vi.mock('@/features/residentes/components/residentes-section', () => ({ ResidentesSection: nada }))
vi.mock('@/features/residentes/queries', () => ({ listResidentesDomicilio: vacio() }))
vi.mock('@/features/sincronizacion/queries', () => ({
  estadoDeEntidades: (...a: unknown[]) => estadoDeEntidades(...a),
  estadoDomicilio: vi.fn().mockResolvedValue(null),
}))

import DomicilioDetallePage from './page'

const usuario = (roleName: string) => ({ id: 'u1', email: 'a@b.c', userName: 'Ana', roleName, isActive: true })
const props = { params: Promise.resolve({ id: '8' }) }
const ultimasProps = () => AccesosSection.mock.calls.at(-1)![0]

describe('detalle de domicilio · controles y PIN', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDomicilioInfo.mockResolvedValue({ id: 8, direccion: 'LAGO 1', medios: ['control', 'pin'], id_concepto: 1 })
    listControles.mockResolvedValue([{ id: 41, botones: [] }])
    listBotonesConfigurados.mockResolvedValue([0, 2])
    domicilioSincronizado.mockResolvedValue(true)
    getPinDomicilio.mockResolvedValue('1234')
    estadoDeEntidades.mockResolvedValue(new Map())
    getEstadoAccesoDomicilio.mockResolvedValue({ es_moroso: true, acceso_forzado: null, forzado_por_nombre: null, forzado_en: null })
  })

  it.each(['administrador', 'tesorero'])('%s ve el PIN guardado', async (rol) => {
    getCurrentUser.mockResolvedValue(usuario(rol))
    render(await DomicilioDetallePage(props))
    expect(getPinDomicilio).toHaveBeenCalledWith(expect.anything(), 8)
    expect(ultimasProps()).toMatchObject({ pin: { valor: '1234', sincronizado: true } })
  })

  it.each(['comite', 'vigilancia'])('%s no lee pines_acceso: recibe pin undefined', async (rol) => {
    getCurrentUser.mockResolvedValue(usuario(rol))
    render(await DomicilioDetallePage(props))
    expect(getPinDomicilio).not.toHaveBeenCalled()
    expect(ultimasProps()).toMatchObject({ pin: { valor: undefined, sincronizado: true } })
  })

  it('pasa controles, botones configurados (RLS) y su estado', async () => {
    getCurrentUser.mockResolvedValue(usuario('administrador'))
    render(await DomicilioDetallePage(props))
    expect(listBotonesConfigurados).toHaveBeenCalledWith(expect.anything(), null)
    expect(estadoDeEntidades).toHaveBeenCalledWith(expect.anything(), null, 'control', [41])
    expect(ultimasProps()).toMatchObject({ controles: [{ id: 41 }], botonesConfigurados: [0, 2] })
  })

  it.each([
    ['administrador', true],
    ['tesorero', false],
  ])('%s: bloque de acceso con puedeAjustar=%s', async (rol, puede) => {
    getCurrentUser.mockResolvedValue(usuario(rol))
    render(await DomicilioDetallePage(props))
    expect(AccesoForzado).toHaveBeenCalledWith(expect.objectContaining({ domicilioId: 8, puedeAjustar: puede }))
  })

  it.each(['comite', 'vigilancia'])('%s no ve el bloque de acceso ni llama la RPC', async (rol) => {
    getCurrentUser.mockResolvedValue(usuario(rol))
    render(await DomicilioDetallePage(props))
    expect(getEstadoAccesoDomicilio).not.toHaveBeenCalled()
    expect(AccesoForzado).not.toHaveBeenCalled()
  })
})
