import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FilaRegistro } from '../traduccion'
import { RegistrosTabla } from './registros-tabla'

const fila = (id: number, permitido: boolean): FilaRegistro => ({
  id,
  fechaHora: '13/11/2026 08:15:02',
  panel: 'P1',
  titular: 'Calle 1',
  origen: 'Tarjeta',
  credencial: 'Tarjeta 1',
  salida: 'Pluma',
  permitido,
  resultado: permitido ? 'Permitido' : 'Denegado',
  motivo: permitido ? 'Permitido' : 'Sin permiso',
})
const href = (n: number) => `/accesos?desde=2026-11-01&hasta=2026-11-13&resultado=denegado&pagina=${n}`

describe('RegistrosTabla', () => {
  it('columnas, badges, total y paginación con filtros', () => {
    render(<RegistrosTabla filas={[fila(1, true), fila(2, false)]} total={1234} pagina={2} paginas={25} hrefPagina={href} />)
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Fecha y hora', 'Panel', 'Domicilio / Titular', 'Origen', 'Credencial', 'Salida', 'Resultado', 'Motivo',
    ])
    const filas = screen.getAllByRole('row').slice(1)
    expect(within(filas[0]).getAllByText('Permitido')).toHaveLength(2)
    expect(within(filas[1]).getByText('Denegado')).toBeInTheDocument()
    expect(screen.getByText(/Mostrando 51 a 52 de 1,234 registros/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Última página' })).toHaveAttribute('href', href(25))
    expect(screen.getByRole('link', { name: 'Página anterior' })).toHaveAttribute('href', href(1))
    expect(screen.getByRole('link', { name: 'Página siguiente' })).toHaveAttribute('href', href(3))
  })

  it('primera y última página deshabilitan los extremos', () => {
    render(<RegistrosTabla filas={[fila(1, true)]} total={1} pagina={1} paginas={1} hrefPagina={href} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
  })

  it('vacío', () => {
    render(<RegistrosTabla filas={[]} total={0} pagina={1} paginas={0} hrefPagina={href} />)
    expect(screen.getByText('No hay registros con estos filtros.')).toBeInTheDocument()
  })
  it('página más allá de la última: conserva el paginador para volver', () => {
    render(<RegistrosTabla filas={[]} total={120} pagina={9} paginas={3} hrefPagina={href} />)
    expect(screen.queryByText('No hay registros con estos filtros.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Página 3' })).toHaveAttribute('href', href(3))
    expect(screen.getByRole('link', { name: 'Página anterior' })).toHaveAttribute('href', href(3))
  })
})
