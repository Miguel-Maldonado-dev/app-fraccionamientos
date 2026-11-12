import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppBar } from './app-bar'

vi.mock('next/navigation', () => ({ usePathname: () => '/domicilios' }))
vi.mock('@/features/auth/actions', () => ({ logout: vi.fn() }))

describe('AppBar', () => {
  it('el botón del avatar tiene un área táctil de 40 px', () => {
    render(<AppBar user={{ userName: 'Ana', roleName: 'administrador', fraccionamientoNombre: 'Fracc Demo', variante: 'fraccionamiento' }} />)
    expect(screen.getByRole('button', { name: 'Usuario: Ana' })).toHaveClass('size-10')
  })

  it('muestra el isotipo en la barra móvil', () => {
    render(<AppBar user={{ userName: 'Ana', roleName: 'administrador', fraccionamientoNombre: 'Fracc Demo', variante: 'fraccionamiento' }} />)
    expect(screen.getByRole('img', { name: 'WEADMI' })).toBeInTheDocument()
  })

  it('muestra el nombre del fraccionamiento', () => {
    render(<AppBar user={{ userName: 'Ana', roleName: 'administrador', fraccionamientoNombre: 'Fracc Demo', variante: 'fraccionamiento' }} />)
    expect(screen.getByText('Fracc Demo')).toBeInTheDocument()
  })

  it('el menú móvil (Sheet) ofrece el botón Cerrar en español', async () => {
    render(<AppBar user={{ userName: 'Ana', roleName: 'administrador', fraccionamientoNombre: 'Fracc Demo', variante: 'fraccionamiento' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('variante plataforma muestra "Consola de plataforma"', () => {
    render(<AppBar user={{ userName: 'Root', roleName: null, fraccionamientoNombre: '', variante: 'plataforma' }} />)
    expect(screen.getByText('Consola de plataforma')).toBeInTheDocument()
  })
})
