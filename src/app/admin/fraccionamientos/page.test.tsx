import { render, screen } from '@testing-library/react'
import type { FraccionamientoResumen } from '@/features/fraccionamientos/queries'

const requireSuperAdminPage = vi.fn()
const listFraccionamientos = vi.fn()
const listarInstalacionesDisponibles = vi.fn()
vi.mock('@/lib/auth/require-super-admin-page', () => ({ requireSuperAdminPage: () => requireSuperAdminPage() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))
vi.mock('@/features/fraccionamientos/queries', () => ({ listFraccionamientos: () => listFraccionamientos() }))
vi.mock('@/features/fraccionamientos/access-core', () => ({
  listarInstalacionesDisponibles: (...a: unknown[]) => listarInstalacionesDisponibles(...a),
}))
vi.mock('@/features/fraccionamientos/actions', () => ({ crearFraccionamiento: vi.fn(), actualizarFraccionamiento: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import FraccionamientosPage from './page'

const rows: FraccionamientoResumen[] = [
  { id: 1, nombre: 'Lago Amadeo', slug: 'lago-amadeo', activo: true, instalacionId: null, instalacionNombre: null, usuarios: 2, domicilios: 10 },
]

describe('fraccionamientos page', () => {
  beforeEach(() => {
    requireSuperAdminPage.mockReset().mockResolvedValue(undefined)
    listFraccionamientos.mockReset().mockResolvedValue(rows)
    listarInstalacionesDisponibles.mockReset().mockResolvedValue([])
  })

  it('un tesorero recibe notFound()', async () => {
    requireSuperAdminPage.mockRejectedValue(new Error('NOT_FOUND'))
    await expect(FraccionamientosPage()).rejects.toThrow('NOT_FOUND')
    expect(listFraccionamientos).not.toHaveBeenCalled()
  })

  it('muestra encabezado, acción y tabla', async () => {
    render(await FraccionamientosPage())
    expect(screen.getByRole('heading', { name: 'Fraccionamientos' })).toBeInTheDocument()
    expect(screen.getByText('Crea y administra los fraccionamientos de la plataforma.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nuevo fraccionamiento' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lago Amadeo' })).toBeInTheDocument()
  })

  it('consulta las instalaciones disponibles y sigue renderizando si la API falla (null)', async () => {
    listarInstalacionesDisponibles.mockResolvedValue(null)
    render(await FraccionamientosPage())
    expect(listarInstalacionesDisponibles).toHaveBeenCalledWith({})
    expect(screen.getByRole('link', { name: 'Lago Amadeo' })).toBeInTheDocument()
  })
})
