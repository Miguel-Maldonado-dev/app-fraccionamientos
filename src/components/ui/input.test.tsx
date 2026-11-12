import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './input'

describe('Input', () => {
  it('mide 44 px y resalta el borde primario en foco', () => {
    render(<Input aria-label="Nombre" />)
    const cls = screen.getByLabelText('Nombre').className
    expect(cls).toContain('h-11')
    expect(cls).toContain('focus-visible:border-primary')
    expect(cls).toContain('border-input')
    expect(cls).toContain('aria-invalid:border-danger')
  })
})
