import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MetricasPlataforma } from './metricas-plataforma'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('../actions', () => ({ crearFraccionamiento: vi.fn(), actualizarFraccionamiento: vi.fn() }))

const rows = [
  { id: 1, nombre: 'Lago Amadeo', activo: true, domicilios: 120, residentes: 300, usuariosActivos: 3, tarjetas: 40, telefonos: 55 },
  { id: 2, nombre: 'Los Pinos', activo: false, domicilios: 8, residentes: 9, usuariosActivos: 1, tarjetas: 2, telefonos: 3 },
]

describe('MetricasPlataforma', () => {
  it('muestra las seis tarjetas y una fila por fraccionamiento', () => {
    render(<MetricasPlataforma rows={rows} />)
    const valor = (label: string) => screen.getAllByText(label)[0].parentElement!.textContent
    expect(valor('Fraccionamientos')).toContain('1 de 2')
    expect(valor('Domicilios')).toContain('128')
    expect(valor('Residentes')).toContain('309')
    expect(valor('Usuarios activos')).toContain('4')
    expect(valor('Tarjetas de acceso')).toContain('42')
    expect(valor('Teléfonos de acceso')).toContain('58')
    expect(screen.getByText('Por fraccionamiento')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lago Amadeo' })).toHaveAttribute('href', '/admin/fraccionamientos/1')
    const fila = screen.getByRole('row', { name: /Lago Amadeo/ })
    expect(within(fila).getByText('Activo')).toBeInTheDocument()
    expect(within(fila).getByText('120')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Los Pinos/ })).getByText('Inactivo')).toBeInTheDocument()
  })

  it('la tabla usa la variante tarjeta con ícono en el título', () => {
    const { container } = render(<MetricasPlataforma rows={rows} />)
    expect(container.querySelector('tr[data-variante="tarjeta"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="section-card-icon-tile"]')).not.toBeNull()
  })

  it('sin filas muestra el estado vacío con la acción', () => {
    render(<MetricasPlataforma rows={[]} />)
    expect(screen.getByText('Aún no hay fraccionamientos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nuevo fraccionamiento' })).toBeInTheDocument()
  })
})
