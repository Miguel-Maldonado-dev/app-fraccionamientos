import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from './brand-logo'

describe('BrandLogo', () => {
  it('muestra el logotipo oficial con su proporción', () => {
    render(<BrandLogo width={160} />)
    const img = screen.getByRole('img', { name: 'WEADMI' })
    expect(img).toHaveAttribute('alt', 'WEADMI')
    expect(img).toHaveAttribute('width', '160')
    expect(img).toHaveAttribute('height', '33')
    expect(img.getAttribute('src')).toContain('weadmi-logotipo.png')
  })

  it('el isotipo es cuadrado', () => {
    render(<BrandLogo variant="isotipo" width={32} />)
    const img = screen.getByRole('img', { name: 'WEADMI' })
    expect(img).toHaveAttribute('width', '32')
    expect(img).toHaveAttribute('height', '32')
    expect(img.getAttribute('src')).toContain('weadmi-isotipo.png')
  })

  it('con subtitulo lo muestra', () => {
    render(<BrandLogo width={160} subtitulo="Fracc Demo" />)
    expect(screen.getByText('Fracc Demo')).toBeInTheDocument()
  })
})
