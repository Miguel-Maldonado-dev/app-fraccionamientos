import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportesTabs } from './reportes-tabs'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/reportes',
}))

describe('ReportesTabs', () => {
  it('solo ofrece el reporte de pagos por usuario (sin accesos vehicular ni peatonal)', () => {
    render(
      <ReportesTabs tab="usuario">
        <div />
      </ReportesTabs>,
    )
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Pagos por usuario'])
  })
})
