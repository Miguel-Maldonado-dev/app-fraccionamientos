import { render, screen } from '@testing-library/react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { DateBlock } from './date-block'
import { IconButton } from './icon-button'
import { PeriodoPill } from './periodo-pill'
import { StatChip } from './stat-chip'

describe('piezas de tarjeta', () => {
  it('DateBlock muestra día y mes abreviado', () => {
    render(<DateBlock fecha="2026-11-13" />)
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('NOV')).toBeInTheDocument()
  })

  it('DateBlock con fecha vacía o inválida muestra un guion', () => {
    const { rerender } = render(<DateBlock fecha="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('NaN')).toBeNull()
    rerender(<DateBlock fecha="no-fecha" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('IconButton usa label como nombre accesible y aplica tono danger', () => {
    render(<IconButton icon={Trash2} label="Eliminar" tono="danger" />)
    const btn = screen.getByRole('button', { name: 'Eliminar' })
    expect(btn).toHaveAttribute('title', 'Eliminar')
    expect(btn).toHaveClass('text-danger-foreground')
  })

  it('StatChip muestra valor y etiqueta', () => {
    render(<StatChip icon={CheckCircle2} valor={3} etiqueta="Pagadas" tono="success" />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Pagadas')).toBeInTheDocument()
  })

  it('PeriodoPill renderiza su contenido', () => {
    render(<PeriodoPill>Nov/2026</PeriodoPill>)
    expect(screen.getByText('Nov/2026')).toHaveAttribute('data-slot', 'periodo-pill')
  })
})
