import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DomicilioInfo } from '@/features/domicilios/queries'
import type { EstadoEntidad } from '@/features/sincronizacion/queries'
import type { MedioAcceso } from '@/lib/constants'
import type { Tables } from '@/lib/supabase/types'
import { AccesosSection } from './accesos-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({
  crearTelefono: vi.fn(),
  actualizarTelefono: vi.fn(),
  eliminarTelefono: vi.fn(),
  crearTarjeta: vi.fn(),
  actualizarTarjeta: vi.fn(),
  eliminarTarjeta: vi.fn(),
}))
vi.mock('@/features/controles/actions', () => ({
  crearControl: vi.fn(),
  actualizarControl: vi.fn(),
  eliminarControl: vi.fn(),
}))
vi.mock('@/features/pin/actions', () => ({
  fijarPinDomicilio: vi.fn(),
  generarPinDomicilio: vi.fn(),
  quitarPinDomicilio: vi.fn(),
}))
vi.mock('@/features/sincronizacion/actions', () => ({
  reintentarTarea: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

const domicilio = (over: Partial<DomicilioInfo> = {}): DomicilioInfo => ({
  id: 7,
  direccion: 'Calle 1',
  fecha_alta: '2026-01-01',
  observaciones: null,
  residente_principal: 'Ana',
  id_concepto: 1,
  tipo_cuota: 'Mensual',
  medios: [],
  estatus: 'Al corriente',
  ...over,
})

const tarjeta = (over: Partial<Tables<'tarjetas_acceso'>> = {}) =>
  ({
    id: 31,
    domicilio_id: 7,
    numero: '8518512',
    descripcion: 'Auto rojo',
    tarjeta_id: null,
    ...over,
  }) as Tables<'tarjetas_acceso'>

function renderCon(
  medios: MedioAcceso[],
  opts: { dom?: Partial<DomicilioInfo>; tarjetas?: Tables<'tarjetas_acceso'>[]; estados?: Map<number, EstadoEntidad> } = {},
) {
  render(
    <AccesosSection
      domicilio={domicilio(opts.dom)}
      medios={medios}
      telefonos={[]}
      tarjetas={opts.tarjetas ?? []}
      estados={opts.estados}
    />,
  )
}

describe('AccesosSection', () => {
  it('muestra teléfonos y tarjetas cuando el tipo de cuota los incluye', () => {
    renderCon(['tarjeta', 'telefono'])
    expect(screen.getByText('Números de acceso')).toBeInTheDocument()
    expect(screen.getByText('Tarjetas de acceso')).toBeInTheDocument()
  })

  it('oculta las tarjetas si medios no incluye tarjeta, aunque existan registros', () => {
    renderCon(['telefono'], { tarjetas: [tarjeta()] })
    expect(screen.queryByText('Tarjetas de acceso')).not.toBeInTheDocument()
    expect(screen.queryByText('8518512')).not.toBeInTheDocument()
    expect(screen.getByText('Números de acceso')).toBeInTheDocument()
  })

  it('los teléfonos avisan que aún no se sincronizan', () => {
    renderCon(['telefono'])
    expect(screen.getByText('Se sincronizará cuando access-core lo soporte')).toBeInTheDocument()
  })

  it('sin tipo de cuota muestra el aviso', () => {
    renderCon([], { dom: { id_concepto: null, tipo_cuota: null } })
    expect(screen.getByText('Asigna un tipo de cuota para habilitar los medios de acceso')).toBeInTheDocument()
    expect(screen.queryByText('Tarjetas de acceso')).not.toBeInTheDocument()
  })

  it('con tipo de cuota sin medios no muestra el aviso ni tarjetas', () => {
    renderCon([])
    expect(screen.queryByText('Asigna un tipo de cuota para habilitar los medios de acceso')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarjetas de acceso')).not.toBeInTheDocument()
  })

  it('cada tarjeta muestra su descripción y su estado de sincronización', async () => {
    const estados = new Map<number, EstadoEntidad>([[31, { estado: 'error', error: 'La tarjeta ya existe', tareaId: 'tk-1' }]])
    renderCon(['tarjeta'], { tarjetas: [tarjeta()], estados })
    expect(screen.getByText('8518512')).toBeInTheDocument()
    expect(screen.getByText('Auto rojo')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('La tarjeta ya existe')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    const { reintentarTarea } = await import('@/features/sincronizacion/actions')
    expect(reintentarTarea).toHaveBeenCalledWith('tk-1')
  })

  it('sin permiso para reintentar no muestra el botón', () => {
    const estados = new Map<number, EstadoEntidad>([[31, { estado: 'error', error: 'x', tareaId: 'tk-1' }]])
    render(
      <AccesosSection
        domicilio={domicilio()}
        medios={['tarjeta']}
        telefonos={[]}
        tarjetas={[tarjeta()]}
        estados={estados}
        puedeReintentar={false}
      />,
    )
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('monta la tarjeta de controles cuando el tipo incluye control, con su estado', () => {
    const control = {
      id: 41,
      domicilio_id: 7,
      fraccionamiento_id: 1,
      control_id: null,
      descripcion: 'Portón',
      botones: [{ boton: 0, rf_code: 5, boton_id: null }],
      created_at: '2026-11-11',
    } as Tables<'controles_acceso'>
    render(
      <AccesosSection
        domicilio={domicilio()}
        medios={['control']}
        telefonos={[]}
        tarjetas={[]}
        controles={[control]}
        botonesConfigurados={[0]}
        estadosControles={new Map([[41, { estado: 'ok', error: null, tareaId: 't1' }]])}
      />,
    )
    expect(screen.getByText('Controles')).toBeInTheDocument()
    expect(screen.getByText('Portón')).toBeInTheDocument()
    expect(screen.getByText('Sincronizado')).toBeInTheDocument()
    expect(screen.queryByText('PIN')).not.toBeInTheDocument()
  })

  it('oculta los controles si el tipo no incluye control', () => {
    renderCon(['tarjeta'])
    expect(screen.queryByText('Controles')).not.toBeInTheDocument()
  })

  it('monta la tarjeta de PIN cuando el tipo incluye pin', () => {
    render(
      <AccesosSection
        domicilio={domicilio()}
        medios={['pin']}
        telefonos={[]}
        tarjetas={[]}
        pin={{ valor: '1234', sincronizado: true }}
      />,
    )
    expect(screen.getByText('PIN')).toBeInTheDocument()
    expect(screen.getByText('1234')).toBeInTheDocument()
    expect(screen.queryByText('Controles')).not.toBeInTheDocument()
  })
})
