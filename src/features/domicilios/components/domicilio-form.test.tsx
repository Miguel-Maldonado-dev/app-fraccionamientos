import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DomicilioForm } from './domicilio-form'

const conceptos = [{ id: 1, nombre: 'Cuota', importe: 100 }] as never

async function openSelect(allowSinAsignar?: boolean, mostrarImporte?: boolean) {
  render(
    <DomicilioForm
      conceptos={conceptos}
      onSubmit={async () => {}}
      submitLabel="Guardar"
      allowSinAsignar={allowSinAsignar}
      mostrarImporte={mostrarImporte}
    />,
  )
  await userEvent.click(screen.getByRole('combobox'))
}

describe('DomicilioForm', () => {
  it('muestra "Sin asignar" por defecto', async () => {
    await openSelect()
    expect(screen.getByRole('option', { name: 'Sin asignar' })).toBeInTheDocument()
  })
  it('oculta "Sin asignar" con allowSinAsignar={false}', async () => {
    await openSelect(false)
    expect(screen.getByRole('option', { name: /Cuota/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Sin asignar' })).toBeNull()
  })
  it('por defecto muestra el importe del tipo de cuota', async () => {
    await openSelect()
    expect(screen.getByRole('option', { name: /Cuota — \$100/ })).toBeInTheDocument()
  })
  it('con mostrarImporte={false} solo muestra el nombre', async () => {
    await openSelect(true, false)
    expect(screen.getByRole('option', { name: 'Cuota' })).toBeInTheDocument()
    expect(screen.queryByText(/\$/)).toBeNull()
  })
})
