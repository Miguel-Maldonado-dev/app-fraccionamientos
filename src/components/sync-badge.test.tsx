import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SyncBadge } from './sync-badge'

describe('SyncBadge', () => {
  it('sin tarea no muestra nada', () => {
    const { container } = render(<SyncBadge estado={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ok se muestra como Sincronizado', () => {
    render(<SyncBadge estado="ok" />)
    expect(screen.getByText('Sincronizado')).toBeInTheDocument()
    expect(screen.getByText('Sincronizado').closest('[data-slot="badge"]')).toHaveAttribute('data-variant', 'success')
  })

  it('pendiente se muestra como Pendiente', () => {
    render(<SyncBadge estado="pendiente" />)
    expect(screen.getByText('Pendiente').closest('[data-slot="badge"]')).toHaveAttribute('data-variant', 'warning')
  })

  it('Error muestra el mensaje y Reintentar llama al callback', async () => {
    const onReintentar = vi.fn()
    render(<SyncBadge estado="error" error="La tarjeta ya existe" onReintentar={onReintentar} />)
    const badge = screen.getByText('Error').closest('[data-slot="badge"]')!
    expect(badge).toHaveAttribute('data-variant', 'danger')
    expect(badge).toHaveAttribute('title', 'La tarjeta ya existe')
    expect(screen.getByText('La tarjeta ya existe')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onReintentar).toHaveBeenCalledTimes(1)
  })

  it('sin onReintentar no ofrece reintentar', () => {
    render(<SyncBadge estado="error" error="x" />)
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})
