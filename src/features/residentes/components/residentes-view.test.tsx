import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ResidenteConDomicilio } from '../queries'
import { ResidentesView } from './residentes-view'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ eliminarResidente: vi.fn(), crearResidente: vi.fn(), actualizarResidente: vi.fn() }))
vi.mock('../cuentas-actions', () => ({ quitarAccesoApp: vi.fn(), desligarDispositivo: vi.fn() }))

type Row = ResidenteConDomicilio
const row = (id: number, nombre: string, direccion: string, user_id: string | null = null): Row => ({
  id,
  domicilio_id: id,
  fraccionamiento_id: 1,
  nombre,
  direccion,
  telefono: '5551234567',
  es_principal: id === 1,
  user_id,
  created_at: '2026-11-13T00:00:00Z',
})
const rows = [row(1, 'Ever Hernandez', 'LAGO UNO'), row(2, 'Ana Lopez', 'LAGO DOS')]
const domicilios = [{ id: 1, direccion: 'LAGO UNO' }]

afterEach(() => vi.useRealTimers())

describe('ResidentesView', () => {
  test('Residente es la primera columna y el domicilio lleva al detalle', () => {
    render(<ResidentesView rows={rows} domicilios={domicilios} />)
    const encabezados = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(encabezados.slice(0, 3)).toEqual(['Residente', 'Teléfono', 'Domicilio'])
    expect(encabezados.at(-1)).toBe('Acciones')
    expect(screen.getByRole('link', { name: 'LAGO UNO' })).toHaveAttribute('href', '/domicilios/1')
    expect(screen.getByRole('button', { name: 'Editar Ever Hernandez' })).toBeInTheDocument()
    expect(screen.queryByText('App')).not.toBeInTheDocument()
  })

  test('con acceso a la app: columna App y acciones de la cuenta', () => {
    const conCuenta = [row(1, 'Ever Hernandez', 'LAGO UNO', 'u1'), row(2, 'Ana Lopez', 'LAGO DOS')]
    render(<ResidentesView rows={conCuenta} domicilios={domicilios} accesoApp dispositivos={[]} puedeDesligar />)
    expect(screen.getByRole('columnheader', { name: 'App' })).toBeInTheDocument()
    expect(screen.getByText('Con acceso')).toBeInTheDocument()
    expect(screen.getByText('Sin acceso')).toBeInTheDocument()
  })

  test('buscar filtra filas', () => {
    vi.useFakeTimers()
    render(<ResidentesView rows={rows} domicilios={domicilios} />)
    const input = screen.getByPlaceholderText('Buscar por nombre, teléfono o domicilio...')
    fireEvent.change(input, { target: { value: 'hernandez' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByText('Ever Hernandez')).toBeInTheDocument()
    expect(screen.queryByText('Ana Lopez')).not.toBeInTheDocument()
  })

  test('Limpiar filtros vacía el buscador y no reaplica la búsqueda', () => {
    vi.useFakeTimers()
    render(<ResidentesView rows={rows} domicilios={domicilios} />)
    const input = screen.getByPlaceholderText('Buscar por nombre, teléfono o domicilio...')
    fireEvent.change(input, { target: { value: 'hernandez' } })
    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/ }))
    expect(input).toHaveValue('')
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(input).toHaveValue('')
    expect(screen.getByText('Ever Hernandez')).toBeInTheDocument()
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
  })
})
