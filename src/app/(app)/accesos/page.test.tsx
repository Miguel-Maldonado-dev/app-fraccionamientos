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
vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ refresh: vi.fn() }) }))
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

import AccesosPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({})
  instalacionDe.mockResolvedValue({ fid: 1, instalacionId: 'i' })
})

describe('/accesos', () => {
  it('comité recibe 404', async () => {
    requireRole.mockRejectedValue(new AuthorizationError('FORBIDDEN'))
    await expect(AccesosPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('exige administrador o tesorero', async () => {
    render(await AccesosPage())
    expect(requireRole).toHaveBeenCalledWith('administrador', 'tesorero')
    expect(screen.getByRole('button', { name: 'Procesar ahora' })).toBeInTheDocument()
  })

  it('sin instalación muestra el aviso', async () => {
    instalacionDe.mockResolvedValue(null)
    render(await AccesosPage())
    expect(screen.getByText('Pide al super admin vincular la instalación de access-core')).toBeInTheDocument()
  })
})
