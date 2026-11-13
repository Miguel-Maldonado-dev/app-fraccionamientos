import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/require-role'

const requireRole = vi.hoisted(() => vi.fn())
const instalacionDe = vi.hoisted(() => vi.fn())
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)
vi.mock('next/navigation', () => ({
  notFound,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/accesos',
}))
vi.mock('@/lib/auth/require-role', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/require-role')>()),
  requireRole: (...a: unknown[]) => requireRole(...a),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))
vi.mock('@/features/sincronizacion/cola', () => ({ instalacionDe: (...a: unknown[]) => instalacionDe(...a) }))
vi.mock('@/features/sincronizacion/queries', () => ({
  listTareasAbiertas: vi.fn().mockResolvedValue([]),
  resumenSincronizacion: vi.fn().mockResolvedValue({ pendientes: 0, errores: 0, ultimaOk: null }),
}))
vi.mock('@/features/sincronizacion/actions', () => ({ procesarAhora: vi.fn(), reintentarTarea: vi.fn() }))

const consultarRegistros = vi.hoisted(() => vi.fn())
const opcionesRegistros = vi.hoisted(() => vi.fn())
vi.mock('@/features/registros-acceso/actions', () => ({
  consultarRegistros: (...a: unknown[]) => consultarRegistros(...a),
  opcionesRegistros: (...a: unknown[]) => opcionesRegistros(...a),
}))

import AccesosPage from './page'

const props = (sp: Record<string, string> = {}) => ({ searchParams: Promise.resolve(sp) })

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({ roleName: 'administrador' })
  consultarRegistros.mockResolvedValue({ ok: true, filas: [], total: 0, pagina: 1, paginas: 0 })
  opcionesRegistros.mockResolvedValue({ domicilios: [], paneles: [] })
  instalacionDe.mockResolvedValue({ fid: 1, instalacionId: 'i' })
})

describe('/accesos', () => {
  it('comité recibe 404', async () => {
    requireRole.mockRejectedValue(new AuthorizationError('FORBIDDEN'))
    await expect(AccesosPage(props())).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('exige administrador o tesorero', async () => {
    render(await AccesosPage(props({ vista: 'sincronizacion' })))
    expect(requireRole).toHaveBeenCalledWith('administrador', 'tesorero')
    expect(screen.getByRole('tab', { name: 'Sincronización' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Procesar ahora' })).toBeInTheDocument()
    expect(consultarRegistros).not.toHaveBeenCalled()
  })

  it('administrador ve Registros por omisión, de su propio fraccionamiento', async () => {
    render(await AccesosPage(props({ desde: '2026-11-13', hasta: '2026-11-13' })))
    expect(screen.getByRole('tab', { name: 'Registros' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Sincronización' })).toBeInTheDocument()
    expect(consultarRegistros).toHaveBeenCalledWith(null, expect.objectContaining({ pagina: 1 }))
    expect(opcionesRegistros).toHaveBeenCalledWith(null)
    expect(screen.getByText('No hay registros con estos filtros.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Procesar ahora' })).not.toBeInTheDocument()
  })

  it('tesorero ve solo la sincronización, sin Registros', async () => {
    requireRole.mockResolvedValue({ roleName: 'tesorero' })
    render(await AccesosPage(props({ vista: 'registros' })))
    expect(screen.queryByRole('tab', { name: 'Registros' })).not.toBeInTheDocument()
    expect(screen.queryByText('Registros')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Procesar ahora' })).toBeInTheDocument()
    expect(consultarRegistros).not.toHaveBeenCalled()
  })

  it('sin instalación muestra el aviso', async () => {
    instalacionDe.mockResolvedValue(null)
    render(await AccesosPage(props({ vista: 'sincronizacion' })))
    expect(screen.getByText('Pide al super admin vincular la instalación de access-core')).toBeInTheDocument()
  })
})
