import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it.each([
    ['Pagado', 'success'],
    ['Al corriente', 'success'],
    ['Activo', 'success'],
    ['Pendiente', 'warning'],
    ['En gracia', 'warning'],
    ['Vencido', 'danger'],
    ['Moroso', 'danger'],
    ['Inactivo', 'neutral'],
    ['Tesorero', 'info'],
    ['Otro', 'neutral'],
  ])('%s usa el tono %s', (status, tone) => {
    render(<StatusBadge status={status} />)
    const el = screen.getByText(status)
    expect(el).toHaveClass(`bg-${tone}-light`)
    expect(el).toHaveClass(`text-${tone}-foreground`)
    expect(el.firstElementChild).toHaveClass(`bg-${tone}`)
  })

  it('Pendiente no usa el texto de marca del tono', () => {
    render(<StatusBadge status="Pendiente" />)
    expect(screen.getByText('Pendiente')).not.toHaveClass('text-warning')
  })

  it('Administrador usa primario', () => {
    render(<StatusBadge status="Administrador" />)
    expect(screen.getByText('Administrador')).toHaveClass('bg-primary-light')
  })

  it('null renderiza vacío con estilo neutro', () => {
    const { container } = render(<StatusBadge status={null} />)
    expect(container.firstElementChild).toHaveClass('bg-neutral-light')
    expect(container.firstElementChild).toHaveTextContent('')
  })
})
