import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { REGLAS_COBRO_POR_OMISION } from '../schemas'
import { ejemploReglas, ReglasCobroForm } from './reglas-cobro-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const conceptos = [{ id: 3, nombre: 'Recargo 10%', monto: 100 }]

describe('ejemploReglas', () => {
  it('venc 31, gracia 5, con recargo', () => {
    expect(ejemploReglas({ ...REGLAS_COBRO_POR_OMISION, diaVencimiento: 31, diasGracia: 5, conceptoRecargoId: 3 })).toBe(
      'Las cuotas vencen el día 31; el recargo se aplica el día 1; el acceso cambia a moroso el día 6.',
    )
  })
  it('mes vencido', () => {
    expect(ejemploReglas({ diaGeneracion: 20, diaVencimiento: 10, diasGracia: 0, conceptoRecargoId: null })).toBe(
      'Las cuotas vencen el día 10 del mes siguiente; el acceso cambia a moroso el día 11.',
    )
  })
  it('último día del mes', () => {
    expect(ejemploReglas(REGLAS_COBRO_POR_OMISION)).toContain('el último día del mes')
  })
})

describe('ReglasCobroForm', () => {
  it('muestra el texto de ejemplo para venc 31 / gracia 5', () => {
    render(
      <ReglasCobroForm
        reglas={{ ...REGLAS_COBRO_POR_OMISION, diaVencimiento: 31, diasGracia: 5, conceptoRecargoId: 3 }}
        conceptos={conceptos}
        guardar={vi.fn()}
      />,
    )
    expect(screen.getByTestId('ejemplo-reglas')).toHaveTextContent(
      'Las cuotas vencen el día 31; el recargo se aplica el día 1; el acceso cambia a moroso el día 6.',
    )
  })

  it('guarda los valores como números y nulos', async () => {
    const guardar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    render(<ReglasCobroForm reglas={REGLAS_COBRO_POR_OMISION} conceptos={conceptos} guardar={guardar} />)
    await userEvent.type(screen.getByLabelText('Día de vencimiento'), '15')
    await userEvent.clear(screen.getByLabelText('Días de gracia'))
    await userEvent.type(screen.getByLabelText('Días de gracia'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reglas' }))
    expect(guardar).toHaveBeenCalledWith({
      diaGeneracion: null,
      diaVencimiento: 15,
      diasGracia: 3,
      cuotasParaMoroso: 1,
      conceptoRecargoId: null,
    })
  })

  it('un valor fuera de rango muestra el error y no guarda', async () => {
    const guardar = vi.fn()
    render(<ReglasCobroForm reglas={REGLAS_COBRO_POR_OMISION} conceptos={conceptos} guardar={guardar} />)
    await userEvent.type(screen.getByLabelText('Día de generación automática'), '29')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reglas' }))
    expect(screen.getByRole('alert')).toHaveTextContent('entre 1 y 28')
    expect(guardar).not.toHaveBeenCalled()
  })

  it('solo lectura: sin botón de guardar y campos deshabilitados', () => {
    render(<ReglasCobroForm reglas={REGLAS_COBRO_POR_OMISION} conceptos={conceptos} guardar={vi.fn()} soloLectura />)
    expect(screen.queryByRole('button', { name: 'Guardar reglas' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Días de gracia')).toBeDisabled()
  })
})
