import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CuotaInfo } from '../queries'
import { CuotasSection } from './cuotas-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({}))
vi.mock('../cancelacion-actions', () => ({ cancelarCuotas: vi.fn(), reactivarCuota: vi.fn() }))

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

  describe('cancelación', () => {
    const cancelada = {
      ...cuota(5, 'Cancelado'),
      estatus_calculado: 'Cancelada',
      cancelada_en: '2026-11-12T18:00:00Z',
      motivo_cancelacion: 'Convenio',
      cancelada_por_nombre: 'Ana Admin',
    } as CuotaInfo
    const todas = [cuota(1, 'Pagado'), cuota(2, 'Pendiente'), cuota(3, 'Vencido'), cuota(4, 'En gracia'), cancelada]

    it('admin: casillas en Pendiente/Vencido/En gracia y Cancelada; botones solo con selección', async () => {
      const user = userEvent.setup()
      render(<CuotasSection {...props} cuotas={todas} puedeGestionar puedeCancelar />)
      const fila = (c: string) => screen.getByText(c).closest('tr')!
      for (const c of ['Cuota 2', 'Cuota 3', 'Cuota 4', 'Cuota 5']) {
        expect(within(fila(c)).getByRole('checkbox')).toBeInTheDocument()
      }
      expect(within(fila('Cuota 1')).queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Cancelar cuotas/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Reactivar/ })).not.toBeInTheDocument()
      await user.click(within(fila('Cuota 2')).getByRole('checkbox'))
      expect(screen.getByRole('button', { name: /Cancelar cuotas \(1\)/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Reactivar/ })).not.toBeInTheDocument()
      await user.click(within(fila('Cuota 5')).getByRole('checkbox'))
      expect(screen.getByRole('button', { name: /Reactivar \(1\)/ })).toBeInTheDocument()
    })

    it('cancelada: badge, motivo, sin pagar/editar ni botón por fila; chips', () => {
      render(<CuotasSection {...props} cuotas={todas} puedeGestionar puedeCancelar />)
      const fila = screen.getByText('Cuota 5').closest('tr')!
      expect(within(fila).getByText('Cancelada')).toBeInTheDocument()
      expect(within(fila).getByText(/Cancelada por Ana Admin el .*: Convenio/)).toBeInTheDocument()
      expect(fila).toHaveClass('opacity-60')
      expect(within(fila).queryByRole('button', { name: 'Pagar 5' })).not.toBeInTheDocument()
      expect(within(fila).queryByRole('button', { name: 'Editar cuota' })).not.toBeInTheDocument()
      expect(within(fila).queryByRole('button', { name: /Reactivar/ })).not.toBeInTheDocument()
      const chip = (e: string) => screen.getByText(e).closest('[data-slot="stat-chip"]')! as HTMLElement
      expect(within(chip('Pendientes')).getByText('3')).toBeInTheDocument()
      expect(within(chip('Canceladas')).getByText('1')).toBeInTheDocument()
    })

    it('tesorero: sin casillas ni Reactivar; sin canceladas no hay chip', () => {
      const { unmount } = render(<CuotasSection {...props} cuotas={todas} puedeGestionar />)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reactivar' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Cancelar cuotas/ })).not.toBeInTheDocument()
      unmount()
      render(<CuotasSection {...props} cuotas={cuotas} puedeGestionar />)
      expect(screen.queryByText('Canceladas')).not.toBeInTheDocument()
    })
  })
})
