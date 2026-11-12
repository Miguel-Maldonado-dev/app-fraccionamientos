import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddDomicilioDialog } from './add-domicilio-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ crearDomicilio: vi.fn() }))

const conceptos = [{ id: 1, nombre: 'Cuota', importe: 100 }] as never

async function abrirTipos(props: { mostrarImporte?: boolean; permitirSinAsignar?: boolean }) {
  render(<AddDomicilioDialog conceptos={conceptos} {...props} />)
  await userEvent.click(screen.getByRole('button', { name: /Nuevo Domicilio/ }))
  await userEvent.click(screen.getByRole('combobox'))
}

describe('AddDomicilioDialog', () => {
  it('por defecto (administrador) muestra el importe', async () => {
    await abrirTipos({})
    expect(screen.getByRole('option', { name: /Cuota — \$100/ })).toBeInTheDocument()
  })
  it('con mostrarImporte={false} (consola) no muestra dinero', async () => {
    await abrirTipos({ mostrarImporte: false })
    expect(screen.getByRole('option', { name: 'Cuota' })).toBeInTheDocument()
    expect(screen.queryByText(/\$/)).toBeNull()
  })
  it('por defecto (administrador) ofrece "Sin asignar"', async () => {
    await abrirTipos({})
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeInTheDocument()
  })
  it('con permitirSinAsignar={false} (consola) no ofrece "Sin asignar"', async () => {
    await abrirTipos({ permitirSinAsignar: false })
    expect(screen.getByRole('option', { name: /Cuota/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Sin asignar' })).toBeNull()
  })
})
