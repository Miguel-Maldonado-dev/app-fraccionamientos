import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelarCuotas, reactivarCuota } from '../cancelacion-actions'
import {
  AVISO_CANCELACION,
  CancelarCuotasDialog,
  CuotaCheckbox,
  ReactivarCuotasButton,
  SeleccionCuotasProvider,
} from './cancelar-cuotas-dialog'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../cancelacion-actions', () => ({ cancelarCuotas: vi.fn(), reactivarCuota: vi.fn() }))
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }))

const cuotas = [
  { id: 2, periodo: 'Oct/2026', concepto: 'Mantenimiento', importe: 500 },
  { id: 3, periodo: 'Nov/2026', concepto: 'Mantenimiento', importe: 250 },
]

function Arnes() {
  return (
    <SeleccionCuotasProvider>
      <CancelarCuotasDialog domicilioId={7} cuotas={cuotas} />
      <CuotaCheckbox cuotaId={2} label="Sel 2" />
      <CuotaCheckbox cuotaId={3} label="Sel 3" />
    </SeleccionCuotasProvider>
  )
}

describe('CancelarCuotasDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista las seleccionadas con total, exige motivo y cancela', async () => {
    vi.mocked(cancelarCuotas).mockResolvedValue({ ok: true, data: { canceladas: 2 } })
    const user = userEvent.setup()
    render(<Arnes />)
    // Sin selección el botón no aparece.
    expect(screen.queryByRole('button', { name: /Cancelar cuotas/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Sel 2' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sel 3' }))
    await user.click(screen.getByRole('button', { name: /Cancelar cuotas \(2\)/ }))
    expect(screen.getByText(AVISO_CANCELACION)).toBeInTheDocument()
    expect(screen.getByText('Oct/2026')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    const confirmar = screen.getByRole('button', { name: 'Cancelar cuotas' })
    expect(confirmar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo'), '  Convenio  ')
    await user.click(confirmar)
    await waitFor(() => expect(cancelarCuotas).toHaveBeenCalledWith(7, [2, 3], 'Convenio'))
    expect(toastSuccess).toHaveBeenCalledWith('2 cuotas canceladas')
    expect(refresh).toHaveBeenCalled()
  })
})

describe('ReactivarCuotasButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('solo aparece con canceladas seleccionadas, pide confirmación y reactiva cada una', async () => {
    vi.mocked(reactivarCuota).mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    render(
      <SeleccionCuotasProvider>
        <ReactivarCuotasButton domicilioId={7} cuotaIds={[5, 6]} />
        <CuotaCheckbox cuotaId={5} label="Sel 5" />
        <CuotaCheckbox cuotaId={6} label="Sel 6" />
      </SeleccionCuotasProvider>,
    )
    expect(screen.queryByRole('button', { name: /Reactivar/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Sel 5' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sel 6' }))
    await user.click(screen.getByRole('button', { name: /Reactivar \(2\)/ }))
    expect(reactivarCuota).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Reactivar' }))
    await waitFor(() => expect(reactivarCuota).toHaveBeenCalledTimes(2))
    expect(reactivarCuota).toHaveBeenCalledWith(7, 5)
    expect(reactivarCuota).toHaveBeenCalledWith(7, 6)
    expect(toastSuccess).toHaveBeenCalledWith('2 cuotas reactivadas')
  })
})
