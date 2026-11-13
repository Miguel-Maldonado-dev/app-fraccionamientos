import { render, screen } from '@testing-library/react'
import type { FraccionamientoResumen } from '@/features/fraccionamientos/queries'

const requireSuperAdminPage = vi.fn()
const getFraccionamiento = vi.fn()
const listUsuarios = vi.fn()
const listDomiciliosConsola = vi.fn()
const listTiposCuotaConsola = vi.fn()
const listarInstalacionesDisponibles = vi.fn()
const listarSalidasDe = vi.fn()
const listMedios = vi.fn()
const listBotones = vi.fn()
const listBotonesApp = vi.fn()
const listarSalidasApp = vi.fn()
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('@/lib/auth/require-super-admin-page', () => ({ requireSuperAdminPage: () => requireSuperAdminPage() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))
vi.mock('@/features/fraccionamientos/queries', () => ({
  getFraccionamiento: (...a: unknown[]) => getFraccionamiento(...a),
  listMedios: (...a: unknown[]) => listMedios(...a),
  listBotones: (...a: unknown[]) => listBotones(...a),
}))
vi.mock('@/features/fraccionamientos/access-core', () => ({
  listarInstalacionesDisponibles: (...a: unknown[]) => listarInstalacionesDisponibles(...a),
  listarSalidasDe: (...a: unknown[]) => listarSalidasDe(...a),
}))
const listTareasAbiertas = vi.fn()
vi.mock('@/features/sincronizacion/queries', () => ({
  listTareasAbiertas: (...a: unknown[]) => listTareasAbiertas(...a),
  resumenSincronizacion: vi.fn().mockResolvedValue({ pendientes: 0, errores: 0, ultimaOk: null }),
}))
vi.mock('@/features/sincronizacion/actions', () => ({
  procesarAhoraEnFraccionamiento: vi.fn(),
  reintentarTareaEnFraccionamiento: vi.fn(),
}))
vi.mock('@/features/app-botones/queries', () => ({
  listBotonesApp: (...a: unknown[]) => listBotonesApp(...a),
  listarSalidasApp: (...a: unknown[]) => listarSalidasApp(...a),
}))
vi.mock('@/features/app-botones/actions', () => ({ guardarBoton: vi.fn(), eliminarBoton: vi.fn(), reordenarBotones: vi.fn() }))
vi.mock('@/features/fraccionamientos/medios-actions', () => ({ guardarMediosDeFraccionamiento: vi.fn() }))
vi.mock('@/features/fraccionamientos/botones-actions', () => ({ guardarBotonesDeFraccionamiento: vi.fn() }))
vi.mock('@/features/domicilios/queries', () => ({
  listDomiciliosConsola: (...a: unknown[]) => listDomiciliosConsola(...a),
  listTiposCuotaConsola: (...a: unknown[]) => listTiposCuotaConsola(...a),
}))
vi.mock('@/features/fraccionamientos/operacion-actions', () => ({ crearDomicilioEnFraccionamiento: vi.fn() }))
vi.mock('@/features/domicilios/actions', () => ({ crearDomicilio: vi.fn(), actualizarDomicilio: vi.fn() }))
vi.mock('@/features/usuarios/queries', () => ({ listUsuarios: (...a: unknown[]) => listUsuarios(...a) }))
vi.mock('@/features/fraccionamientos/actions', () => ({ crearFraccionamiento: vi.fn(), actualizarFraccionamiento: vi.fn() }))
vi.mock('@/features/fraccionamientos/usuarios-actions', () => ({
  crearUsuarioEnFraccionamiento: vi.fn(),
  cambiarEstadoUsuarioEnFraccionamiento: vi.fn(),
}))
vi.mock('@/features/usuarios/actions', () => ({ crearUsuario: vi.fn(), cambiarEstadoUsuario: vi.fn(), actualizarUsuario: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/fraccionamientos/5',
  useSearchParams: () => new URLSearchParams(),
}))

const obtenerReglasCobro = vi.fn()
const listConceptosRecargo = vi.fn()
vi.mock('@/features/reglas-cobro/queries', () => ({ obtenerReglasCobro: (...a: unknown[]) => obtenerReglasCobro(...a) }))
vi.mock('@/features/reglas-cobro/actions', () => ({ guardarReglasCobroConsola: vi.fn() }))
vi.mock('@/features/cuotas/queries', () => ({ listConceptosRecargo: (...a: unknown[]) => listConceptosRecargo(...a) }))

const consultarRegistros = vi.fn()
const opcionesRegistros = vi.fn()
vi.mock('@/features/registros-acceso/actions', () => ({
  consultarRegistros: (...a: unknown[]) => consultarRegistros(...a),
  opcionesRegistros: (...a: unknown[]) => opcionesRegistros(...a),
}))

import FraccionamientoPage from './page'

const fracc: FraccionamientoResumen = {
  id: 5,
  nombre: 'Los Pinos',
  slug: 'los-pinos',
  activo: true,
  instalacionId: null,
  instalacionNombre: null,
  usuarios: 1,
  domicilios: 0,
}
const usuario = { id: 'u1', user_name: 'Ana Pérez', email: 'ana@x.com', rol: 'administrador', is_active: true }

const domicilio = {
  id: 8,
  direccion: 'LAGO UNO 12',
  fecha_alta: '2026-01-05',
  observaciones: null,
  residente_principal: 'Ana',
  id_concepto: null,
  tipo_cuota: null,
  medios: null,
  estatus: null,
}
const concepto = { id: 3, nombre: 'Completa' }

const props = (id: string, sp: Record<string, string> = {}) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve(sp),
})

describe('detalle de fraccionamiento', () => {
  beforeEach(() => {
    requireSuperAdminPage.mockReset().mockResolvedValue(undefined)
    getFraccionamiento.mockReset().mockResolvedValue(fracc)
    listUsuarios.mockReset().mockResolvedValue([usuario])
    listDomiciliosConsola.mockReset().mockResolvedValue([domicilio])
    listTiposCuotaConsola.mockReset().mockResolvedValue([concepto])
    listarInstalacionesDisponibles.mockReset().mockResolvedValue([])
    listarSalidasDe.mockReset().mockResolvedValue([])
    listMedios.mockReset().mockResolvedValue(['tarjeta'])
    listTareasAbiertas.mockReset().mockResolvedValue([])
    listBotones.mockReset().mockResolvedValue([])
    listBotonesApp.mockReset().mockResolvedValue([])
    listarSalidasApp.mockReset().mockResolvedValue([])
    notFound.mockClear()
  })

  it('exige super admin antes de leer', async () => {
    requireSuperAdminPage.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(FraccionamientoPage(props('5'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getFraccionamiento).not.toHaveBeenCalled()
  })

  it.each(['abc', '5abc', '0', '-1', '1.5'])('id %s no válido → notFound()', async (id) => {
    await expect(FraccionamientoPage(props(id))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
    expect(getFraccionamiento).not.toHaveBeenCalled()
  })

  it('fraccionamiento inexistente → notFound()', async () => {
    getFraccionamiento.mockResolvedValue(null)
    await expect(FraccionamientoPage(props('99'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getFraccionamiento).toHaveBeenCalledWith({}, 99)
    expect(notFound).toHaveBeenCalled()
  })

  it('pestaña Usuarios: encabezado, acciones y usuarios del fraccionamiento', async () => {
    render(await FraccionamientoPage(props('5', { tab: 'usuarios' })))
    expect(screen.getByRole('heading', { name: 'Los Pinos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fraccionamientos' })).toHaveAttribute('href', '/admin/fraccionamientos')
    expect(screen.getByRole('button', { name: 'Editar fraccionamiento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nuevo usuario/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Usuarios' })).toHaveAttribute('aria-selected', 'true')
    expect(listUsuarios).toHaveBeenCalledWith({}, true, 5)
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar usuario' })).not.toBeInTheDocument()
  })

  it('estado=inactivos lee los inactivos', async () => {
    render(await FraccionamientoPage(props('5', { tab: 'usuarios', estado: 'inactivos' })))
    expect(listUsuarios).toHaveBeenCalledWith({}, false, 5)
  })

  it('por defecto abre Domicilios del fraccionamiento, sin estatus y con enlaces de consola', async () => {
    render(await FraccionamientoPage(props('5')))
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveAttribute('aria-selected', 'true')
    expect(listDomiciliosConsola).toHaveBeenCalledWith({}, 5)
    expect(listTiposCuotaConsola).toHaveBeenCalledWith({}, 5)
    expect(screen.queryByRole('columnheader', { name: 'Estatus' })).not.toBeInTheDocument()
    expect(screen.queryByText('Al corriente')).not.toBeInTheDocument()
    expect(screen.queryByText('Moroso')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'LAGO UNO 12' })).toHaveAttribute(
      'href',
      '/admin/fraccionamientos/5/domicilios/8',
    )
    expect(screen.getByRole('button', { name: /Nuevo domicilio/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Nuevo usuario/i })).not.toBeInTheDocument()
    expect(listUsuarios).not.toHaveBeenCalled()
  })

  it('no pasa funciones a DomiciliosView (frontera Server → Client)', async () => {
    const tree = (await FraccionamientoPage(props('5'))) as React.ReactElement
    const encontrados: Record<string, unknown>[] = []
    const visitar = (n: unknown) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(visitar)
      const el = n as React.ReactElement<Record<string, unknown>>
      if ((el.type as { name?: string })?.name === 'DomiciliosView') encontrados.push(el.props)
      const hijos = el.props?.children
      if (hijos) visitar(hijos)
      for (const v of Object.values(el.props ?? {})) if (v && typeof v === 'object' && v !== hijos) visitar(v)
    }
    visitar(tree)
    expect(encontrados).toHaveLength(1)
    expect(Object.values(encontrados[0]).filter((v) => typeof v === 'function')).toEqual([])
    expect(encontrados[0].hrefBase).toBe('/admin/fraccionamientos/5/domicilios')
  })

  it('sin tipos de cuota: botón deshabilitado y aviso', async () => {
    listTiposCuotaConsola.mockResolvedValue([])
    render(await FraccionamientoPage(props('5')))
    expect(screen.getByRole('button', { name: /Nuevo domicilio/i })).toBeDisabled()
    expect(
      screen.getByText('El administrador del fraccionamiento debe capturar los tipos de cuota primero.'),
    ).toBeInTheDocument()
  })

  it('pestaña Reglas de cobro: solo el formulario, sin datos de pagos', async () => {
    obtenerReglasCobro.mockResolvedValue({
      diaGeneracion: null,
      diaVencimiento: 31,
      diasGracia: 5,
      cuotasParaMoroso: 1,
      conceptoRecargoId: null,
    })
    listConceptosRecargo.mockResolvedValue([{ id: 3, nombre: 'Recargo', monto_recargo: 100 }])
    render(await FraccionamientoPage(props('5', { tab: 'cobro' })))
    expect(screen.getByRole('tab', { name: 'Reglas de cobro' })).toHaveAttribute('aria-selected', 'true')
    expect(obtenerReglasCobro).toHaveBeenCalledWith(5)
    expect(listConceptosRecargo).toHaveBeenCalledWith({}, 5)
    expect(screen.getByLabelText('Día de vencimiento')).toHaveValue(31)
    expect(screen.getByRole('button', { name: 'Guardar reglas' })).toBeInTheDocument()
    expect(listDomiciliosConsola).not.toHaveBeenCalled()
    expect(screen.queryByText(/moroso(s)?$/i, { selector: 'th,td' })).not.toBeInTheDocument()
  })

  it('pestaña App de residentes: constructor con vista previa, sin consultar salidas sin instalación', async () => {
    listBotonesApp.mockResolvedValue([
      { id: 1, orden: 1, nombre: 'Pluma', icono: 'pluma', ancho_completo: false, salida_id: null, salida_nombre: null },
    ])
    render(await FraccionamientoPage(props('5', { tab: 'app' })))
    expect(screen.getByRole('tab', { name: 'App de residentes' })).toHaveAttribute('aria-selected', 'true')
    expect(listBotonesApp).toHaveBeenCalledWith({}, 5)
    expect(listarSalidasApp).not.toHaveBeenCalled()
    expect(screen.getByText('1 de 8')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Vista previa de la app' })).toBeInTheDocument()
  })

  it('pestaña App de residentes con instalación consulta salidas', async () => {
    getFraccionamiento.mockResolvedValue({ ...fracc, instalacionId: 'i-1', instalacionNombre: 'Norte' })
    render(await FraccionamientoPage(props('5', { tab: 'app' })))
    expect(listarSalidasApp).toHaveBeenCalledWith('i-1')
  })

  it('pestaña accesos sin instalación: medios y aviso para vincular, sin consultar salidas', async () => {
    render(await FraccionamientoPage(props('5', { tab: 'accesos', vista: 'sincronizacion' })))
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Medios habilitados')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Tarjeta' })).toBeChecked()
    expect(screen.getByText('Botones de los controles')).toBeInTheDocument()
    expect(screen.getByText('Vincula una instalación de access-core para configurar los botones.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Botón 1' })).not.toBeInTheDocument()
    expect(screen.getByText('Vincula una instalación de access-core para sincronizar.')).toBeInTheDocument()
    expect(listarSalidasDe).not.toHaveBeenCalled()
    expect(screen.queryByText('Acceso vehicular')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarjetas de acceso')).not.toBeInTheDocument()
  })

  it('pestaña accesos con instalación: consulta salidas y muestra los botones', async () => {
    getFraccionamiento.mockResolvedValue({ ...fracc, instalacionId: 'i-1', instalacionNombre: 'Norte' })
    render(await FraccionamientoPage(props('5', { tab: 'accesos', vista: 'sincronizacion' })))
    expect(listarSalidasDe).toHaveBeenCalledWith('i-1')
    expect(screen.getByRole('combobox', { name: 'Botón 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Procesar ahora' })).toBeInTheDocument()
    expect(listTareasAbiertas).toHaveBeenCalledWith(expect.anything(), 5, { consola: true })
  })

  it('pestaña accesos no revela el pago: asignar se muestra genérico', async () => {
    getFraccionamiento.mockResolvedValue({ ...fracc, instalacionId: 'i-1', instalacionNombre: 'Norte' })
    listTareasAbiertas.mockResolvedValue([
      { id: 't', domicilio_id: 1, entidad: 'domicilio', operacion: 'asignar', estado: 'pendiente', intentos: 0, ultimo_error: null, direccion: 'Calle 1' },
    ])
    render(await FraccionamientoPage(props('5', { tab: 'accesos', vista: 'sincronizacion' })))
    expect(screen.getByText('Actualizar acceso')).toBeInTheDocument()
    expect(screen.queryByText('Asignar permiso')).not.toBeInTheDocument()
  })

  it('pestaña accesos con la API caída: botones deshabilitados con aviso', async () => {
    getFraccionamiento.mockResolvedValue({ ...fracc, instalacionId: 'i-1', instalacionNombre: 'Norte' })
    listarSalidasDe.mockResolvedValue(null)
    render(await FraccionamientoPage(props('5', { tab: 'accesos', vista: 'sincronizacion' })))
    expect(screen.getByText('No se pudo consultar access-core')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Botón 1' })).toBeDisabled()
  })

  it('no hay pestañas de catálogos y ?tab=cuotas cae en domicilios', async () => {
    render(await FraccionamientoPage(props('5', { tab: 'cuotas' })))
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Domicilios', 'Usuarios', 'Accesos', 'App de residentes', 'Reglas de cobro'])
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveAttribute('aria-selected', 'true')
  })

  it('pestaña accesos por omisión muestra Registros con el id del fraccionamiento', async () => {
    consultarRegistros.mockResolvedValue({ ok: true, filas: [], total: 0, pagina: 1, paginas: 0 })
    opcionesRegistros.mockResolvedValue({ domicilios: [], paneles: [] })
    render(await FraccionamientoPage(props('5', { tab: 'accesos' })))
    expect(screen.getByRole('tab', { name: 'Registros' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Sincronización' })).toBeInTheDocument()
    // Sin aplicar filtros no se consulta; las opciones de los filtros sí se cargan.
    expect(consultarRegistros).not.toHaveBeenCalled()
    expect(opcionesRegistros).toHaveBeenCalledWith(5)
    expect(screen.getByText(/Configura los filtros y presiona/)).toBeInTheDocument()
    expect(screen.queryByText('Medios habilitados')).not.toBeInTheDocument()
  })
})
