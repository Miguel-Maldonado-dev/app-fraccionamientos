import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DomicilioInfo } from '../queries'
import { DomicilioInfoCard } from './domicilio-info-card'

const domicilio = (over: Partial<DomicilioInfo> = {}): DomicilioInfo => ({
  id: 1,
  direccion: 'AMADEO 1000',
  fecha_alta: '2026-05-02',
  observaciones: 'Portón eléctrico',
  residente_principal: 'Ana',
  id_concepto: 3,
  tipo_cuota: 'Acceso Completo',
  medios: ['tarjeta', 'telefono'],
  estatus: 'Al corriente',
  ...over,
})

describe('DomicilioInfoCard', () => {
  it('la dirección es el título de la página', () => {
    render(<DomicilioInfoCard domicilio={domicilio()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'AMADEO 1000' })).toBeInTheDocument()
    expect(screen.getByText('Domicilio del fraccionamiento.')).toBeInTheDocument()
  })

  it('el estatus es un campo de la tarjeta y aparece una sola vez', () => {
    render(<DomicilioInfoCard domicilio={domicilio()} />)
    expect(screen.getByText('Estatus')).toBeInTheDocument()
    expect(screen.getAllByText('Al corriente')).toHaveLength(1)
    expect(screen.getByText('Al corriente').className).toContain('bg-success-light')
  })

  it('muestra fecha de registro y tipo de cuota, sin observaciones', () => {
    render(<DomicilioInfoCard domicilio={domicilio()} />)
    expect(screen.getByText('Fecha de registro')).toBeInTheDocument()
    expect(screen.getByText('02/05/2026')).toBeInTheDocument()
    expect(screen.getByText('Tipo de cuota mensual')).toBeInTheDocument()
    expect(screen.getByText('Acceso Completo')).toBeInTheDocument()
    expect(screen.queryByText('Observaciones')).not.toBeInTheDocument()
    expect(screen.queryByText('Portón eléctrico')).not.toBeInTheDocument()
  })

  it('indica cuando falta el tipo de cuota', () => {
    render(<DomicilioInfoCard domicilio={domicilio({ tipo_cuota: null })} />)
    expect(screen.getByText('Sin asignar')).toHaveClass('text-muted-foreground')
  })

  it('muestra la acción recibida en la esquina de la tarjeta', () => {
    render(<DomicilioInfoCard domicilio={domicilio()} action={<button type="button">Editar domicilio</button>} />)
    expect(screen.getByRole('button', { name: 'Editar domicilio' })).toBeInTheDocument()
  })

  it('mostrarEstatus=false oculta el estatus', () => {
    render(<DomicilioInfoCard domicilio={domicilio()} mostrarEstatus={false} />)
    expect(screen.queryByText('Estatus')).not.toBeInTheDocument()
    expect(screen.queryByText('Al corriente')).not.toBeInTheDocument()
  })

  describe('permiso de acceso', () => {
    it('muestra el permiso asignado', () => {
      render(<DomicilioInfoCard domicilio={domicilio()} permiso={{ nombre: 'Residentes', pendiente: false }} />)
      expect(screen.getByText('Permiso: Residentes')).toBeInTheDocument()
      expect(screen.queryByText('Pendiente')).not.toBeInTheDocument()
    })

    it('marca Pendiente cuando el deseado difiere del asignado', () => {
      render(<DomicilioInfoCard domicilio={domicilio()} permiso={{ nombre: 'Residentes', pendiente: true }} />)
      expect(screen.getByText('Permiso: Residentes')).toBeInTheDocument()
      expect(screen.getByText('Pendiente')).toBeInTheDocument()
    })

    it('sin permiso asignado lo indica', () => {
      render(<DomicilioInfoCard domicilio={domicilio()} permiso={{ nombre: null, pendiente: false }} />)
      expect(screen.getByText('Permiso: Sin asignar')).toBeInTheDocument()
    })

    it('sin instalación (permiso nulo) no muestra nada de acceso', () => {
      render(<DomicilioInfoCard domicilio={domicilio()} permiso={null} />)
      expect(screen.queryByText(/Permiso:/)).not.toBeInTheDocument()
    })

    it('muestra el estado de sincronización recibido', () => {
      render(
        <DomicilioInfoCard
          domicilio={domicilio()}
          permiso={{ nombre: 'Residentes', pendiente: false }}
          sincronizacion={<span>Sincronizado</span>}
        />,
      )
      expect(screen.getByText('Sincronizado')).toBeInTheDocument()
    })
  
    it('sin permiso muestra solo el estado de sincronización recibido (consola)', () => {
      render(<DomicilioInfoCard domicilio={domicilio()} sincronizacion={<span>Sincronizado</span>} />)
      expect(screen.getByText('Sincronizado')).toBeInTheDocument()
      expect(screen.queryByText(/Permiso/)).not.toBeInTheDocument()
    })
  })
})
