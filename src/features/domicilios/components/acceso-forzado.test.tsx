import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccesoForzado, type EstadoAcceso } from './acceso-forzado'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ forzarAcceso: vi.fn().mockResolvedValue({ ok: true, data: undefined }) }))

const estado = (over: Partial<EstadoAcceso> = {}): EstadoAcceso => ({
  es_moroso: false,
  acceso_forzado: null,
  forzado_por_nombre: null,
  forzado_en: null,
  ...over,
})

describe('AccesoForzado', () => {
  it('administrador con domicilio moroso ve "Activar acceso"', () => {
    render(<AccesoForzado domicilioId={1} estado={estado({ es_moroso: true })} puedeAjustar />)
    expect(screen.getByRole('button', { name: 'Activar acceso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar acceso' })).not.toBeInTheDocument()
  })

  it('administrador con domicilio al corriente ve "Desactivar acceso"', () => {
    render(<AccesoForzado domicilioId={1} estado={estado()} puedeAjustar />)
    expect(screen.getByRole('button', { name: 'Desactivar acceso' })).toBeInTheDocument()
  })

  it('tesorero ve la insignia pero ningún botón', () => {
    render(
      <AccesoForzado
        domicilioId={1}
        puedeAjustar={false}
        estado={estado({ es_moroso: true, acceso_forzado: 'activo', forzado_por_nombre: 'Ana', forzado_en: '2026-11-12T18:00:00Z' })}
      />,
    )
    expect(screen.getByText(/Acceso activado manualmente por Ana el/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('con ajuste, el administrador ve "Quitar ajuste"', () => {
    render(
      <AccesoForzado domicilioId={1} puedeAjustar estado={estado({ acceso_forzado: 'inactivo', forzado_por_nombre: 'Ana', forzado_en: '2026-11-12T18:00:00Z' })} />,
    )
    expect(screen.getByText(/Acceso desactivado manualmente por Ana/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar ajuste' })).toBeInTheDocument()
  })
})
