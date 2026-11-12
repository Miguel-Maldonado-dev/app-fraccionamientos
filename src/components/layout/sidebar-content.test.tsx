import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SidebarContent } from './sidebar-content'

const pathname = vi.hoisted(() => ({ value: '/domicilios' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }))
vi.mock('@/features/auth/actions', () => ({ logout: vi.fn() }))

describe('SidebarContent', () => {
  afterEach(() => {
    pathname.value = '/domicilios'
  })

  it('muestra marca, usuario y rol', () => {
    render(<SidebarContent user={{ userName: 'Ana Pérez', roleName: 'administrador', fraccionamientoNombre: 'Fracc Demo', variante: 'fraccionamiento' }} />)
    expect(screen.getByRole('img', { name: 'WEADMI' })).toBeInTheDocument()
    expect(screen.getByText('Fracc Demo')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('marca activo el enlace actual', () => {
    render(<SidebarContent user={{ userName: 'Ana', roleName: 'administrador', fraccionamientoNombre: 'Fracc Demo', variante: 'fraccionamiento' }} />)
    const link = screen.getByRole('link', { name: 'Domicilios' })
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link).toHaveClass('bg-primary-light')
    expect(screen.getByRole('link', { name: 'Pagos' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Pagos' })).not.toHaveClass('bg-primary-light')
  })

  it('con rol Comite no hay enlace Usuarios', () => {
    render(<SidebarContent user={{ userName: 'Luis', roleName: 'comite', fraccionamientoNombre: 'Fracc Demo', variante: 'fraccionamiento' }} />)
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
  })

  it('variante plataforma: subtítulo, rol y menú de consola con el ítem activo correcto', () => {
    pathname.value = '/admin/fraccionamientos/5'
    render(<SidebarContent user={{ userName: 'Root', roleName: null, fraccionamientoNombre: '', variante: 'plataforma' }} />)
    expect(screen.getByText('Consola de plataforma')).toBeInTheDocument()
    expect(screen.getByText('Super admin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fraccionamientos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('link', { name: 'Domicilios' })).not.toBeInTheDocument()
  })

  it('variante plataforma: Inicio activo solo en /admin exacto', () => {
    pathname.value = '/admin'
    render(<SidebarContent user={{ userName: 'Root', roleName: null, fraccionamientoNombre: '', variante: 'plataforma' }} />)
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Fraccionamientos' })).not.toHaveAttribute('aria-current')
  })
})
