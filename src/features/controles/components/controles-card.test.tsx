import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tables } from '@/lib/supabase/types'
import { crearControl, eliminarControl } from '../actions'
import { ControlesCard } from './controles-card'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({
  crearControl: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  actualizarControl: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  eliminarControl: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))
vi.mock('@/features/sincronizacion/actions', () => ({
  reintentarTarea: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

beforeEach(() => vi.clearAllMocks())

const control = (over: Partial<Tables<'controles_acceso'>> = {}) =>
  ({
    id: 41,
    domicilio_id: 9,
    fraccionamiento_id: 7,
    control_id: null,
    descripcion: 'Auto rojo',
    botones: [
      { boton: 0, rf_code: 123456, boton_id: null },
      { boton: 2, rf_code: 777, boton_id: null },
    ],
    created_at: '2026-11-11',
    ...over,
  }) as Tables<'controles_acceso'>

describe('ControlesCard', () => {
  it('sin botones configurados deshabilita "Agregar control" con el aviso', () => {
    render(<ControlesCard domicilioId={9} controles={[]} botonesConfigurados={[]} />)
    expect(screen.getByRole('button', { name: /Agregar control/ })).toBeDisabled()
    expect(screen.getByText('El super admin debe configurar las salidas de los botones')).toBeInTheDocument()
  })

  it('con botones configurados permite agregar', () => {
    render(<ControlesCard domicilioId={9} controles={[]} botonesConfigurados={[0, 1]} />)
    expect(screen.getByRole('button', { name: /Agregar control/ })).toBeEnabled()
    expect(screen.queryByText('El super admin debe configurar las salidas de los botones')).not.toBeInTheDocument()
    expect(screen.getByText('Sin controles')).toBeInTheDocument()
  })

  it('con 2 controles ya no ofrece agregar', () => {
    render(
      <ControlesCard
        domicilioId={9}
        controles={[control(), control({ id: 42, descripcion: 'Moto' })]}
        botonesConfigurados={[0, 1]}
      />,
    )
    expect(screen.queryByRole('button', { name: /Agregar control/ })).not.toBeInTheDocument()
  })

  it('muestra cada control con su descripción, sus botones y su estado de sincronización', () => {
    render(
      <ControlesCard
        domicilioId={9}
        controles={[control()]}
        botonesConfigurados={[0, 2]}
        estados={new Map([[41, { estado: 'pendiente', error: null, tareaId: 't1' }]])}
      />,
    )
    const item = screen.getByRole('listitem')
    expect(within(item).getByText('Auto rojo')).toBeInTheDocument()
    expect(within(item).getByText('Botón 1 · 123456')).toBeInTheDocument()
    expect(within(item).getByText('Botón 3 · 777')).toBeInTheDocument()
    expect(within(item).getByText('Pendiente')).toBeInTheDocument()
  })

  it('agregar ofrece solo los botones configurados y guarda', async () => {
    const user = userEvent.setup()
    render(<ControlesCard domicilioId={9} controles={[]} botonesConfigurados={[0, 2]} />)
    await user.click(screen.getByRole('button', { name: /Agregar control/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Agregar control' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Botón 1')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Botón 3')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Botón 2')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Botón 4')).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Descripción'), 'Auto')
    await user.type(within(dialog).getByLabelText('Botón 3'), '555')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(crearControl).toHaveBeenCalledWith(9, { descripcion: 'Auto', botones: [{ boton: 2, rfCode: '555' }] })
  })

  it('agregar sin ningún código no llama a la acción', async () => {
    const user = userEvent.setup()
    render(<ControlesCard domicilioId={9} controles={[]} botonesConfigurados={[0]} />)
    await user.click(screen.getByRole('button', { name: /Agregar control/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Captura el código de al menos un botón')).toBeInTheDocument()
    expect(crearControl).not.toHaveBeenCalled()
  })

  it('editar precarga los códigos y usa las acciones recibidas', async () => {
    const actualizar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    render(
      <ControlesCard
        domicilioId={9}
        controles={[control()]}
        botonesConfigurados={[0, 2]}
        acciones={{ crearControl: vi.fn(), actualizarControl: actualizar, eliminarControl: vi.fn() }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Editar Auto rojo' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Editar control' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Botón 1')).toHaveValue('123456')
    await user.clear(within(dialog).getByLabelText('Botón 3'))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(actualizar).toHaveBeenCalledWith(41, 9, { descripcion: 'Auto rojo', botones: [{ boton: 0, rfCode: '123456' }] })
  })

  it('editar muestra de solo lectura los botones sin salida configurada', async () => {
    const actualizar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    render(
      <ControlesCard
        domicilioId={9}
        controles={[control()]}
        botonesConfigurados={[0]}
        acciones={{ crearControl: vi.fn(), actualizarControl: actualizar, eliminarControl: vi.fn() }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Editar Auto rojo' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText('Botón 3')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Botón 3 · sin salida configurada')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(actualizar).toHaveBeenCalledWith(41, 9, { descripcion: 'Auto rojo', botones: [{ boton: 0, rfCode: '123456' }] })
  })

  it('eliminar pide confirmación', async () => {
    const user = userEvent.setup()
    render(<ControlesCard domicilioId={9} controles={[control()]} botonesConfigurados={[0]} />)
    await user.click(screen.getByRole('button', { name: 'Eliminar Auto rojo' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }))
    expect(eliminarControl).toHaveBeenCalledWith(41, 9)
  })
})
