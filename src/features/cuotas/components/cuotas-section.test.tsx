import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CuotaInfo } from '../queries'
import { CuotasSection } from './cuotas-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({}))

const cuota = (id: number, estatus: string): CuotaInfo =>
  ({
    id,
    periodo: 'Nov/2026',
    concepto: `Cuota ${id}`,
    importe_cuota: 500,
    fecha_vencimiento_formated: '10/11/2026',
    estatus,
    estatus_calculado: null,
  }) as unknown as CuotaInfo

const props = {
  domicilioId: 7,
  anios: [2026],
  meses: [{ id: 11, name: 'Noviembre' }],
  conceptosDescuento: [],
  conceptosRecargo: [],
  renderPagar: (c: CuotaInfo) => <button type="button">Pagar {c.id}</button>,
  renderRecibo: (c: CuotaInfo) => <button type="button">Recibo {c.id}</button>,
}

describe('CuotasSection', () => {
  const cuotas = [cuota(1, 'Pagado'), cuota(2, 'Pendiente'), cuota(3, 'Vencido')]

  it('muestra descripción y conteos de pagadas y pendientes', () => {
    render(<CuotasSection {...props} cuotas={cuotas} puedeGestionar />)
    expect(screen.getByText('Administración de cuotas y pagos')).toBeInTheDocument()
    const chip = (etiqueta: string) => screen.getByText(etiqueta).closest('[data-slot="stat-chip"]')!
    expect(within(chip('Pagadas') as HTMLElement).getByText('1')).toBeInTheDocument()
    expect(within(chip('Pendientes') as HTMLElement).getByText('2')).toBeInTheDocument()
    expect(screen.getAllByText('Nov/2026')[0]).toHaveAttribute('data-slot', 'periodo-pill')
  })

  it('con gestión: pagar y editar en pendientes, recibo en pagadas', () => {
    render(<CuotasSection {...props} cuotas={cuotas} puedeGestionar />)
    const fila = (c: string) => screen.getByText(c).closest('tr')!
    expect(
      within(fila('Cuota 1'))
        .getAllByRole('button')
        .map((b) => b.textContent || b.getAttribute('aria-label')),
    ).toEqual(['Recibo 1'])
    expect(within(fila('Cuota 2')).getByRole('button', { name: 'Pagar 2' })).toBeInTheDocument()
    expect(within(fila('Cuota 2')).getByRole('button', { name: 'Editar cuota' })).toHaveAttribute(
      'data-tono',
      'default',
    )
  })

  it('En gracia cuenta como pendiente y conserva pagar y editar', () => {
    render(<CuotasSection {...props} cuotas={[cuota(1, 'Pagado'), cuota(4, 'En gracia')]} puedeGestionar />)
    const chip = screen.getByText('Pendientes').closest('[data-slot="stat-chip"]')! as HTMLElement
    expect(within(chip).getByText('1')).toBeInTheDocument()
    const fila = screen.getByText('Cuota 4').closest('tr')!
    expect(within(fila).getByRole('button', { name: 'Pagar 4' })).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Editar cuota' })).toBeInTheDocument()
  })

  it('sin gestión solo ve el recibo', () => {
    render(<CuotasSection {...props} cuotas={cuotas} puedeGestionar={false} />)
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar cuota' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recibo 1' })).toBeInTheDocument()
  })
})
