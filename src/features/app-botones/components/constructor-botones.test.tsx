import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotonApp } from '../schemas'
import { ConstructorBotones, reordenarIds } from './constructor-botones'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const S1 = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const boton = (id: number, extra: Partial<BotonApp> = {}): BotonApp => ({
  id,
  orden: id,
  nombre: `Botón ${id}`,
  icono: 'puerta',
  estilo: 'azul_claro',
  ancho_completo: false,
  salida_id: S1,
  salida_nombre: 'Pluma entrada',
  ...extra,
})

const acciones = { guardar: vi.fn(), eliminar: vi.fn(), reordenar: vi.fn() }
beforeEach(() => {
  for (const f of Object.values(acciones)) f.mockReset().mockResolvedValue({ ok: true, data: undefined })
})

const montar = (botones: BotonApp[], tieneInstalacion = true) =>
  render(
    <ConstructorBotones
      botones={botones}
      salidas={[{ id: S1, alias: 'Pluma entrada' }]}
      tieneInstalacion={tieneInstalacion}
      acciones={acciones}
    />,
  )

const vista = () => screen.getByRole('region', { name: 'Vista previa de la app' })

describe('ConstructorBotones', () => {
  it('muestra el contador y la salida o "Sin salida"', () => {
    montar([boton(1), boton(2, { salida_id: null, salida_nombre: null })])
    expect(screen.getByText('2 de 8')).toBeInTheDocument()
    expect(screen.getByText('Sin salida')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Agregar botón/ })[0]).toBeEnabled()
  })

  it('con 8 botones deshabilita agregar', () => {
    montar([1, 2, 3, 4, 5, 6, 7, 8].map((i) => boton(i)))
    expect(screen.getByText('8 de 8')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar botón/ })).toBeDisabled()
  })

  it('la vista previa estira el último impar y "Ver como moroso" deshabilita', async () => {
    montar([boton(1), boton(2), boton(3)])
    const bs = within(vista()).getAllByRole('button')
    expect(bs[2]).toHaveClass('col-span-2')
    expect(bs[0]).not.toHaveClass('col-span-2')
    for (const b of bs) expect(b).toBeEnabled()
    expect(within(vista()).getByText('Al corriente')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ver como moroso' }))
    for (const b of within(vista()).getAllByRole('button')) expect(b).toBeDisabled()
    expect(within(vista()).getByText('Moroso')).toBeInTheDocument()
  })

  it('reordenar mueve al instante y llama a la acción', async () => {
    montar([boton(1), boton(2), boton(3)])
    expect(screen.getByRole('button', { name: 'Subir Botón 1' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Botón 1' }))
    expect(acciones.reordenar).toHaveBeenCalledWith([2, 1, 3])
    const nombres = within(screen.getByRole('list', { name: 'Botones en orden' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(nombres[0]).toContain('Botón 2')
    expect(within(vista()).getAllByRole('button')[0]).toHaveTextContent('Botón 2')
  })

  it('agrega un botón desde el diálogo', async () => {
    montar([])
    await userEvent.click(screen.getAllByRole('button', { name: /Agregar botón/ })[0])
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Alberca')
    await userEvent.click(screen.getByRole('radio', { name: 'Alberca' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ancho completo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(acciones.guardar).toHaveBeenCalledWith({
        nombre: 'Alberca',
        icono: 'alberca',
        estilo: 'azul_claro',
        anchoCompleto: true,
        salidaId: null,
      }),
    )
  })

  it('sin instalación avisa en el formulario', async () => {
    montar([], false)
    await userEvent.click(screen.getAllByRole('button', { name: /Agregar botón/ })[0])
    expect(screen.getByText('Liga una instalación en la pestaña Accesos')).toBeInTheDocument()
  })

  it('eliminar pide confirmación', async () => {
    montar([boton(1)])
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Botón 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(acciones.eliminar).toHaveBeenCalledWith(1))
  })
})

describe('vista previa con estilos', () => {
  it('azul usa degradado, azul_claro su fondo y todos muestran chip', () => {
    montar([boton(1, { estilo: 'azul' }), boton(2, { estilo: 'azul_claro' })])
    const [b1, b2] = within(vista()).getAllByRole('button')
    expect(b1.getAttribute('style')).toMatch(/linear-gradient/)
    expect(b1.getAttribute('style')?.toLowerCase()).toMatch(/#087be8|rgb\(8, 123, 232\)/)
    expect(b2.getAttribute('style')?.toLowerCase()).toMatch(/#e6f1fd|rgb\(230, 241, 253\)/)
    for (const b of [b1, b2]) expect(b.querySelector('[data-chip]')).not.toBeNull()
  })
})

describe('selector de estilo', () => {
  it('elegir Navy y guardar envía estilo navy', async () => {
    montar([])
    await userEvent.click(screen.getAllByRole('button', { name: /Agregar botón/ })[0])
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Pluma')
    await userEvent.click(screen.getByRole('radio', { name: 'Navy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(acciones.guardar).toHaveBeenCalledWith(expect.objectContaining({ estilo: 'navy' })))
  })

  it('al editar inicia en el estilo del botón y lo conserva', async () => {
    montar([boton(1, { estilo: 'turquesa' })])
    await userEvent.click(screen.getByRole('button', { name: 'Editar Botón 1' }))
    expect(screen.getByRole('radio', { name: 'Turquesa claro' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Azul claro' })).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(acciones.guardar).toHaveBeenCalledWith(expect.objectContaining({ id: 1, estilo: 'turquesa' })),
    )
  })
})

describe('reordenarIds (al soltar un renglón arrastrado)', () => {
  it('mueve el activo a la posición del destino', () => {
    expect(reordenarIds([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4])
    expect(reordenarIds([1, 2, 3, 4], 4, 1)).toEqual([4, 1, 2, 3])
  })
  it('sin destino, sobre sí mismo o con ids desconocidos no cambia nada', () => {
    expect(reordenarIds([1, 2], 1, undefined)).toBeNull()
    expect(reordenarIds([1, 2], 2, 2)).toBeNull()
    expect(reordenarIds([1, 2], 9, 1)).toBeNull()
  })
})

describe('diálogo con vista previa en vivo', () => {
  it('el teléfono del diálogo muestra el borrador mientras se escribe', async () => {
    montar([boton(1), boton(2)])
    await userEvent.click(screen.getByRole('button', { name: 'Editar Botón 2' }))
    const dialogo = screen.getByRole('dialog')
    const nombre = within(dialogo).getByLabelText(/Nombre/)
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Gimnasio')
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Ancho completo' }))
    const tel = within(dialogo).getByRole('region', { name: 'Vista previa de la app' })
    const bs = within(tel).getAllByRole('button')
    expect(bs).toHaveLength(2)
    expect(bs[1]).toHaveTextContent('Gimnasio')
    expect(bs[1]).toHaveClass('col-span-2')
    expect(bs[0]).toHaveClass('col-span-2')
  })

  it('al agregar, el borrador aparece al final', async () => {
    montar([boton(1)])
    await userEvent.click(screen.getAllByRole('button', { name: /Agregar botón/ })[0])
    const tel = within(screen.getByRole('dialog')).getByRole('region', { name: 'Vista previa de la app' })
    const bs = within(tel).getAllByRole('button')
    expect(bs).toHaveLength(2)
    expect(bs[1]).toHaveTextContent('Nombre del botón')
  })
})
