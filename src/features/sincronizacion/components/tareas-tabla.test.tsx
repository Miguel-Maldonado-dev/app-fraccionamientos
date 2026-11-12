import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Tarea } from '../tipos'
import { TareasTabla } from './tareas-tabla'

const tarea = (o: Partial<Tarea & { direccion: string | null }> = {}) =>
  ({
    id: 't-1',
    fraccionamiento_id: 1,
    domicilio_id: 3,
    entidad: 'tarjeta',
    entidad_id: 4,
    operacion: 'crear',
    estado: 'error',
    intentos: 2,
    ultimo_error: 'access-core no respondió',
    direccion: 'Calle 1 #10',
    ...o,
  }) as Tarea & { direccion: string | null }

describe('TareasTabla', () => {
  it('muestra domicilio, medio, operación, intentos, estado y error', () => {
    render(<TareasTabla tareas={[tarea()]} onReintentar={vi.fn()} />)
    expect(screen.getByText('Calle 1 #10')).toBeInTheDocument()
    expect(screen.getByText('Tarjeta')).toBeInTheDocument()
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Error', { selector: '[data-slot="badge"] span' })).toBeInTheDocument()
    expect(screen.getByTitle('access-core no respondió')).toBeInTheDocument()
  })

  it('sin domicilio muestra guion y etiquetas de entidades y operaciones', () => {
    render(
      <TareasTabla
        tareas={[tarea({ direccion: null, domicilio_id: null, entidad: 'control', operacion: 'reconciliar', ultimo_error: null })]}
        onReintentar={vi.fn()}
      />,
    )
    expect(screen.getByText('Control RF')).toBeInTheDocument()
    expect(screen.getByText('Ajustar medios')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('Reintentar llama con el id de la tarea', async () => {
    const onReintentar = vi.fn()
    render(<TareasTabla tareas={[tarea({ id: 't-9' })]} onReintentar={onReintentar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onReintentar).toHaveBeenCalledWith('t-9')
  })

  it('pendiente también se puede reintentar', () => {
    render(<TareasTabla tareas={[tarea({ estado: 'pendiente' })]} onReintentar={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('en la consola, asignar es genérico', () => {
    render(<TareasTabla tareas={[tarea({ operacion: 'asignar' })]} onReintentar={vi.fn()} modo="consola" />)
    expect(screen.getByText('Actualizar acceso')).toBeInTheDocument()
    expect(screen.queryByText('Asignar permiso')).not.toBeInTheDocument()
  })

  it('en la app, asignar es Asignar permiso', () => {
    render(<TareasTabla tareas={[tarea({ operacion: 'asignar' })]} onReintentar={vi.fn()} />)
    expect(screen.getByText('Asignar permiso')).toBeInTheDocument()
  })

  it('en la consola, el error de asignar no revela el perfil', () => {
    const t = tarea({ operacion: 'asignar', ultimo_error: 'Perfil Morosos no encontrado' })
    const { container } = render(<TareasTabla tareas={[t]} onReintentar={vi.fn()} modo="consola" />)
    expect(screen.getByText('No se pudo actualizar el acceso')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('Morosos')
    expect(container.querySelector('[title="No se pudo actualizar el acceso"]')).toBeNull()
  })

  it('en la consola, otras operaciones conservan el error', () => {
    render(<TareasTabla tareas={[tarea()]} onReintentar={vi.fn()} modo="consola" />)
    expect(screen.getByTitle('access-core no respondió')).toBeInTheDocument()
  })

  it('en la app, el error de asignar se muestra', () => {
    render(<TareasTabla tareas={[tarea({ operacion: 'asignar', ultimo_error: 'Perfil Morosos no encontrado' })]} onReintentar={vi.fn()} />)
    expect(screen.getByTitle('Perfil Morosos no encontrado')).toBeInTheDocument()
  })
})
