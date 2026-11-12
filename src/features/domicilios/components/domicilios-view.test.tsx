import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DomicilioInfo } from '../queries'
import { DomiciliosView } from './domicilios-view'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const row: DomicilioInfo = {
  id: 7,
  direccion: 'LAGO UNO',
  fecha_alta: '2026-01-05',
  observaciones: null,
  residente_principal: 'Ana',
  id_concepto: null,
  tipo_cuota: null,
  medios: null,
  estatus: null,
}

describe('DomiciliosView', () => {
  it('por defecto muestra estatus, métricas de pago y enlaces del administrador', () => {
    render(<DomiciliosView rows={[{ ...row, estatus: 'Moroso' }]} />)
    expect(screen.getByRole('columnheader', { name: 'Estatus' })).toBeInTheDocument()
    expect(screen.getByText('Morosos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'LAGO UNO' })).toHaveAttribute('href', '/domicilios/7')
  })

  it('mostrarEstatus=false: sin estatus, sin métricas ni filtro de pago, y con enlaces de consola', () => {
    render(
      <DomiciliosView
        rows={[row]}
        mostrarEstatus={false}
        hrefBase="/admin/fraccionamientos/5/domicilios"
      />,
    )
    expect(screen.queryByRole('columnheader', { name: 'Estatus' })).not.toBeInTheDocument()
    for (const t of ['Al corriente', 'Moroso', 'Morosos', 'Estatus']) {
      expect(screen.queryByText(t)).not.toBeInTheDocument()
    }
    expect(screen.getByText('Total de unidades')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'LAGO UNO' })).toHaveAttribute(
      'href',
      '/admin/fraccionamientos/5/domicilios/7',
    )
  })
})
