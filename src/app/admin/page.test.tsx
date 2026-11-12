import { render, screen } from '@testing-library/react'

const requireSuperAdminPage = vi.fn()
vi.mock('@/lib/auth/require-super-admin-page', () => ({ requireSuperAdminPage: () => requireSuperAdminPage() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))
const listMetricas = vi.fn()
vi.mock('@/features/fraccionamientos/metricas', async (orig) => ({
  ...(await orig<typeof import('@/features/fraccionamientos/metricas')>()),
  listMetricasFraccionamientos: (...a: unknown[]) => listMetricas(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/features/fraccionamientos/actions', () => ({ crearFraccionamiento: vi.fn(), actualizarFraccionamiento: vi.fn() }))

import AdminPage from './page'

describe('admin inicio', () => {
  beforeEach(() => {
    requireSuperAdminPage.mockReset().mockResolvedValue(undefined)
    listMetricas.mockReset().mockResolvedValue([
      { id: 1, nombre: 'Lago', activo: true, domicilios: 3, residentes: 4, usuariosActivos: 1, tarjetas: 2, telefonos: 5 },
    ])
  })

  it('un tesorero recibe notFound()', async () => {
    requireSuperAdminPage.mockRejectedValue(new Error('NOT_FOUND'))
    await expect(AdminPage()).rejects.toThrow('NOT_FOUND')
    expect(listMetricas).not.toHaveBeenCalled()
  })

  it('muestra el encabezado y las métricas', async () => {
    render(await AdminPage())
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByText('Resumen de la plataforma.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lago' })).toBeInTheDocument()
    expect(screen.getByText('Teléfonos de acceso')).toBeInTheDocument()
  })
})
