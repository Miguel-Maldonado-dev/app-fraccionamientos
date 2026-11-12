import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { guardarCatalogo } from '../actions'
import { CatalogoSection } from './catalogo-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ guardarTipoCuota: vi.fn(), guardarCatalogo: vi.fn() }))

const rows = [{ id: 3, nombre: 'Comité', importe: 250 }]

describe('CatalogoSection', () => {
  it('muestra los elementos del catálogo', () => {
    render(<CatalogoSection catalogo="descuentos" rows={rows} />)
    expect(screen.getByRole('columnheader', { name: 'Monto' })).toBeInTheDocument()
    expect(screen.getByText('Comité')).toBeInTheDocument()
  })

  it('pasa la prop guardar a los diálogos', async () => {
    const guardar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    render(<CatalogoSection catalogo="descuentos" rows={rows} guardar={guardar} />)
    await user.click(screen.getByRole('button', { name: 'Editar Comité' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(guardar).toHaveBeenCalledWith('descuentos', 3, { nombre: 'Comité', importe: 250 })
    expect(guardarCatalogo).not.toHaveBeenCalled()
  })
})
