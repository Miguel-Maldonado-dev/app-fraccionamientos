import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Tables } from '@/lib/supabase/types'
import { desligarDispositivo } from '../cuentas-actions'
import { ResidentesSection } from './residentes-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../cuentas-actions', () => ({
  darAccesoApp: vi.fn(),
  quitarAccesoApp: vi.fn(),
  desligarDispositivo: vi.fn(),
  restablecerPasswordResidente: vi.fn(),
}))
vi.mock('../actions', () => ({
  crearResidente: vi.fn(),
  actualizarResidente: vi.fn(),
  eliminarResidente: vi.fn(),
}))

const residente = (id: number, nombre: string, es_principal: boolean): Tables<'residentes'> => ({
  id,
  domicilio_id: 7,
  fraccionamiento_id: 1,
  nombre,
  telefono: '5551234567',
  es_principal,
  created_at: '2026-01-01T00:00:00Z',
  user_id: null,
})

describe('ResidentesSection', () => {
  it('marca al residente principal con la etiqueta Sí', () => {
    render(
      <ResidentesSection
        domicilioId={7}
        residentes={[residente(1, 'Ana López', true), residente(2, 'Luis Pérez', false)]}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'Residente Principal' })).toBeInTheDocument()
    const fila = (nombre: string) => screen.getByText(nombre).closest('tr')!
    expect(within(fila('Ana López')).getByText('Sí').className).toContain('bg-success-light')
    expect(within(fila('Luis Pérez')).queryByText('Sí')).not.toBeInTheDocument()
  })

  it('los botones de acción nombran al residente', () => {
    render(<ResidentesSection domicilioId={7} residentes={[residente(1, 'Ana López', true)]} />)
    expect(screen.getByRole('button', { name: 'Editar Ana López' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar Ana López' })).toBeInTheDocument()
  })

  it('los botones de acción tienen borde, como en el resto de la app', () => {
    render(<ResidentesSection domicilioId={7} residentes={[residente(1, 'Ana López', true)]} />)
    expect(screen.getByRole('button', { name: 'Editar Ana López' })).toHaveAttribute('data-tono', 'default')
    expect(screen.getByRole('button', { name: 'Eliminar Ana López' })).toHaveAttribute('data-tono', 'danger')
  })

  it('el residente no principal muestra "—"', () => {
    render(<ResidentesSection domicilioId={7} residentes={[residente(2, 'Luis Pérez', false)]} />)
    const fila = screen.getByText('Luis Pérez').closest('tr')!
    expect(within(fila).getByText('—')).toBeInTheDocument()
  })

  it('eliminar sigue pidiendo confirmación', async () => {
    const user = userEvent.setup()
    render(<ResidentesSection domicilioId={7} residentes={[residente(1, 'Ana López', true)]} />)
    await user.click(screen.getByRole('button', { name: 'Eliminar Ana López' }))
    expect(screen.getByText('¿Deseas eliminar este residente? Esta acción no se puede deshacer.')).toBeInTheDocument()
    const { eliminarResidente } = await import('../actions')
    expect(eliminarResidente).not.toHaveBeenCalled()
  })
})

describe('ResidentesSection · acciones personalizadas', () => {
  it('el botón de eliminar llama a la acción recibida', async () => {
    const acciones = {
      crear: vi.fn(),
      actualizar: vi.fn(),
      eliminar: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    }
    const user = userEvent.setup()
    render(<ResidentesSection domicilioId={7} residentes={[residente(1, 'Ana López', true)]} acciones={acciones} />)
    await user.click(screen.getByRole('button', { name: 'Eliminar Ana López' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(acciones.eliminar).toHaveBeenCalledWith(1, 7)
    const { eliminarResidente } = await import('../actions')
    expect(eliminarResidente).not.toHaveBeenCalled()
  })
})

describe('ResidentesSection · acceso a la app', () => {
  const conCuenta = { ...residente(2, 'Luis Pérez', false), user_id: 'u-1' }
  const sinCuenta = residente(1, 'Ana López', true)

  it('sin accesoApp no muestra nada de la app', () => {
    render(<ResidentesSection domicilioId={7} residentes={[conCuenta]} />)
    expect(screen.queryByText(/Acceso a la app/)).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'App' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /acceso a la app/i })).not.toBeInTheDocument()
  })

  it('muestra el contador y la insignia de cada residente', () => {
    render(<ResidentesSection domicilioId={7} residentes={[sinCuenta, conCuenta]} accesoApp={{ max: 5 }} />)
    expect(screen.getByText('Acceso a la app: 1 de 5')).toBeInTheDocument()
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
    expect(screen.getByText('con acceso')).toBeInTheDocument()
    const fila = (n: string) => screen.getByText(n).closest('tr')!
    expect(within(fila('Luis Pérez')).getByText('Con acceso')).toBeInTheDocument()
    expect(within(fila('Ana López')).getByText('Sin acceso')).toBeInTheDocument()
  })

  it('las acciones dependen de si tiene cuenta', () => {
    render(<ResidentesSection domicilioId={7} residentes={[sinCuenta, conCuenta]} accesoApp={{ max: 5 }} />)
    expect(screen.getByRole('button', { name: 'Dar acceso a la app a Ana López' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar acceso a la app a Ana López' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restablecer contraseña de Luis Pérez' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar acceso a la app a Luis Pérez' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dar acceso a la app a Luis Pérez' })).not.toBeInTheDocument()
  })

  it('al agregar, la casilla muestra teléfono y contraseña', async () => {
    const user = userEvent.setup()
    render(<ResidentesSection domicilioId={7} residentes={[]} accesoApp={{ max: 5 }} />)
    await user.click(screen.getByRole('button', { name: 'Agregar Residente' }))
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Dar acceso a la app'))
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Teléfono')).toBeInTheDocument()
  })

  it('sin permiso para agregar (tesorero) oculta el botón pero conserva las acciones de cuenta', () => {
    render(
      <ResidentesSection domicilioId={7} residentes={[sinCuenta]} accesoApp={{ max: 5 }} puedeAgregar={false} />,
    )
    expect(screen.queryByRole('button', { name: 'Agregar Residente' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dar acceso a la app a Ana López' })).toBeInTheDocument()
  })
})

describe('ResidentesSection · dispositivo', () => {
  const conCuenta = { ...residente(2, 'Luis Pérez', false), user_id: 'u-1' }
  const sinCuenta = residente(1, 'Ana López', true)
  const dispositivos = [{ user_id: 'u-1', nombre: 'Pixel 8', ligado_en: '2026-11-10T15:00:00Z' }]

  it('muestra el dispositivo ligado o "Sin dispositivo" solo en residentes con cuenta', () => {
    const otro = { ...residente(3, 'Eva Ruiz', false), user_id: 'u-2' }
    render(
      <ResidentesSection domicilioId={7} residentes={[sinCuenta, conCuenta, otro]} accesoApp={{ max: 5 }} dispositivos={dispositivos} />,
    )
    const fila = (n: string) => screen.getByText(n).closest('tr')!
    expect(within(fila('Luis Pérez')).getByText('Dispositivo: Pixel 8 · ligado el 10/11/2026')).toBeInTheDocument()
    expect(within(fila('Eva Ruiz')).getByText('Sin dispositivo')).toBeInTheDocument()
    expect(within(fila('Ana López')).queryByText(/dispositivo/i)).not.toBeInTheDocument()
  })

  it('sin nombre muestra "Sin nombre"', () => {
    render(
      <ResidentesSection domicilioId={7} residentes={[conCuenta]} accesoApp={{ max: 5 }} dispositivos={[{ ...dispositivos[0], nombre: null }]} />,
    )
    expect(screen.getByText(/Dispositivo: Sin nombre · ligado el/)).toBeInTheDocument()
  })

  it('el tesorero (sin puedeDesligar) no ve la acción', () => {
    render(<ResidentesSection domicilioId={7} residentes={[conCuenta]} accesoApp={{ max: 5 }} dispositivos={dispositivos} />)
    expect(screen.queryByRole('button', { name: /Desligar dispositivo/ })).not.toBeInTheDocument()
  })

  it('el administrador desliga tras confirmar', async () => {
    vi.mocked(desligarDispositivo).mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    render(
      <ResidentesSection domicilioId={7} residentes={[conCuenta]} accesoApp={{ max: 5 }} dispositivos={dispositivos} puedeDesligar />,
    )
    await user.click(screen.getByRole('button', { name: 'Desligar dispositivo de Luis Pérez' }))
    expect(screen.getByText('El residente podrá iniciar sesión en un teléfono nuevo.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desligar dispositivo' }))
    expect(desligarDispositivo).toHaveBeenCalledWith(2)
  })

  it('sin dispositivos (consola) no muestra insignia ni acción', () => {
    render(<ResidentesSection domicilioId={7} residentes={[conCuenta]} puedeDesligar />)
    expect(screen.queryByText(/dispositivo/i)).not.toBeInTheDocument()
  })

  it('residente con cuenta sin dispositivo y no principal: "—", "Sin dispositivo" y solo sus acciones', () => {
    render(<ResidentesSection domicilioId={7} residentes={[conCuenta]} accesoApp={{ max: 5 }} dispositivos={[]} />)
    const fila = screen.getByText('Luis Pérez').closest('tr')!
    expect(within(fila).getByText('—')).toBeInTheDocument()
    expect(within(fila).getByText('Sin dispositivo')).toBeInTheDocument()
    expect(within(fila).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Restablecer contraseña de Luis Pérez',
      'Quitar acceso a la app a Luis Pérez',
      'Editar Luis Pérez',
      'Eliminar Luis Pérez',
    ])
  })
})
