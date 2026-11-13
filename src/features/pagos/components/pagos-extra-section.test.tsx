import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PagoInfo } from '../queries'
import { PagosExtraSection } from './pagos-extra-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({}))

describe('PagosExtraSection', () => {
  it('muestra el encabezado de tarjeta y la fila con su recibo', () => {
    const pago = { id: 9, concepto: 'Multa', importe: 200, fecha_pago: '2026-11-10' } as unknown as PagoInfo
    render(
      <PagosExtraSection
        domicilioId={7}
        pagos={[pago]}
        puedeGestionar={false}
        domicilios={[]}
        conceptos={[]}
        metodos={[]}
      />,
    )
    expect(screen.getByText('Cobros adicionales del domicilio')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="section-card-icon-tile"]')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Concepto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recibo' })).toBeInTheDocument()
  })
})
