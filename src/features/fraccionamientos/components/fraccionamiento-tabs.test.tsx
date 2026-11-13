import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FraccionamientoTabs } from './fraccionamiento-tabs'

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

describe('FraccionamientoTabs', () => {
  it('muestra Domicilios, Usuarios, Accesos, App de residentes y Reglas de cobro, y cambia la pestaña en la URL', async () => {
    render(
      <FraccionamientoTabs id={5} tab="domicilios">
        contenido
      </FraccionamientoTabs>,
    )
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Domicilios', 'Usuarios', 'Accesos', 'App de residentes', 'Reglas de cobro'])
    expect(screen.getByRole('tab', { name: 'Domicilios' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Accesos' }))
    expect(replace).toHaveBeenCalledWith('/admin/fraccionamientos/5?tab=accesos')
  })
})
