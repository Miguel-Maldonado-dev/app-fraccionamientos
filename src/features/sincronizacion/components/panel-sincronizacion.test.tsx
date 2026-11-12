import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tarea } from '../tipos'
import { PanelSincronizacion } from './panel-sincronizacion'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const refresh = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const resumen = { pendientes: 2, errores: 1, ultimaOk: '2026-11-11T18:30:00Z' }
const tareas = [
  {
    id: 't-1',
    domicilio_id: 3,
    entidad: 'domicilio',
    operacion: 'crear',
    estado: 'error',
    intentos: 1,
    ultimo_error: 'boom',
    direccion: 'Calle 1',
  },
] as unknown as (Tarea & { direccion: string | null })[]

const ok = { ok: true as const, data: { omitido: false, procesadas: 0, fallidas: 0, detenidoPor429: false, noConfigurado: false } }
function acciones() {
  return { procesar: vi.fn().mockResolvedValue(ok), reintentar: vi.fn().mockResolvedValue({ ok: true, data: undefined }) }
}

beforeEach(() => vi.clearAllMocks())

describe('PanelSincronizacion', () => {
  it('sin instalación muestra el aviso y no la tabla', () => {
    render(<PanelSincronizacion resumen={resumen} tareas={[]} acciones={acciones()} tieneInstalacion={false} />)
    expect(screen.getByText('Pide al super admin vincular la instalación de access-core')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Procesar ahora' })).not.toBeInTheDocument()
  })

  it('mensaje de instalación personalizado en la consola', () => {
    render(
      <PanelSincronizacion
        resumen={resumen}
        tareas={[]}
        acciones={acciones()}
        tieneInstalacion={false}
        mensajeSinInstalacion="Vincula una instalación de access-core para sincronizar."
      />,
    )
    expect(screen.getByText('Vincula una instalación de access-core para sincronizar.')).toBeInTheDocument()
  })

  it('muestra el resumen', () => {
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={acciones()} tieneInstalacion />)
    expect(screen.getByText('Pendientes')).toBeInTheDocument()
    expect(screen.getByText('Con error')).toBeInTheDocument()
    expect(screen.getByText('Última sincronización')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('sin sincronización previa muestra guion', () => {
    render(<PanelSincronizacion resumen={{ ...resumen, ultimaOk: null }} tareas={[]} acciones={acciones()} tieneInstalacion />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('Reintentar llama a la acción con el id', async () => {
    const a = acciones()
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={a} tieneInstalacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(a.reintentar).toHaveBeenCalledWith('t-1')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('Procesar ahora avisa del resultado', async () => {
    const a = acciones()
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={a} tieneInstalacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Procesar ahora' }))
    expect(a.procesar).toHaveBeenCalled()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sincronización procesada'))
  })

  it('si otra ejecución tiene el lease lo dice', async () => {
    const a = acciones()
    a.procesar.mockResolvedValue({ ok: true, data: { ...ok.data, omitido: true } })
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={a} tieneInstalacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Procesar ahora' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Ya hay una sincronización en curso; intenta en unos minutos.'),
    )
  })

  it('con tareas fallidas avisa cuántas', async () => {
    const a = acciones()
    a.procesar.mockResolvedValue({ ok: true, data: { ...ok.data, procesadas: 5, fallidas: 2 } })
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={a} tieneInstalacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Procesar ahora' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Se procesaron 5 tareas; 2 con error.'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('si access-core pidió esperar lo dice', async () => {
    const a = acciones()
    a.procesar.mockResolvedValue({ ok: true, data: { ...ok.data, detenidoPor429: true } })
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={a} tieneInstalacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Procesar ahora' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('access-core pidió esperar; se reintentará después.'))
  })

  it('si access-core no está configurado lo dice', async () => {
    const a = acciones()
    a.procesar.mockResolvedValue({ ok: true, data: { ...ok.data, noConfigurado: true } })
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={a} tieneInstalacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Procesar ahora' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('access-core no está configurado'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('error de la acción se muestra', async () => {
    const a = acciones()
    a.procesar.mockResolvedValue({ ok: false, error: 'No' })
    render(<PanelSincronizacion resumen={resumen} tareas={tareas} acciones={a} tieneInstalacion />)
    await userEvent.click(screen.getByRole('button', { name: 'Procesar ahora' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No'))
  })

  it('sin tareas muestra estado vacío', () => {
    render(<PanelSincronizacion resumen={resumen} tareas={[]} acciones={acciones()} tieneInstalacion />)
    expect(screen.getByText('Todo está sincronizado')).toBeInTheDocument()
  })
})
