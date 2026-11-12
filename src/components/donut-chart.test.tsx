import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DonutChart } from './donut-chart'

describe('DonutChart', () => {
  it('expone aria-label y leyenda', () => {
    const { container } = render(
      <DonutChart
        segments={[
          { label: 'Al corriente', value: 152, color: 'success' },
          { label: 'Morosos', value: 6, color: 'danger' },
        ]}
        total={158}
        centerLabel="Unidades"
        centerValue="158"
      />,
    )
    const svg = container.querySelector('svg[role=img]')
    expect(svg?.getAttribute('aria-label')).toContain('Al corriente: 152 (96.2 %)')
    expect(screen.getByText('Morosos')).toBeInTheDocument()
    expect(screen.getByText('158')).toBeInTheDocument()
  })

  it('success y danger usan los colores de estado; series-* usan chart', () => {
    const { container } = render(
      <DonutChart
        segments={[
          { label: 'A', value: 5, color: 'success' },
          { label: 'B', value: 3, color: 'danger' },
          { label: 'C', value: 2, color: 'series-1' },
        ]}
        total={10}
        centerLabel="x"
        centerValue="10"
      />,
    )
    const arcs = container.querySelectorAll('svg circle:not(.stroke-muted)')
    expect(arcs[0]).toHaveClass('stroke-success')
    expect(arcs[1]).toHaveClass('stroke-danger')
    expect(arcs[2]).toHaveClass('stroke-chart-1')
  })
})
