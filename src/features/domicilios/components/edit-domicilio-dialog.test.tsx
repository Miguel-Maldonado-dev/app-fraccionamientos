import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import type { DomicilioInfo } from '../queries'
import { EditDomicilioDialog } from './edit-domicilio-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ actualizarDomicilio: vi.fn() }))

const domicilio = {
  id: 5,
  direccion: 'LAGO 1',
  fecha_alta: '2026-01-01',
  observaciones: '',
} as DomicilioInfo
const conceptos = [{ id: 3, nombre: 'Cuota', importe: 100 }] as never

async function abrir(props: Partial<Parameters<typeof EditDomicilioDialog>[0]> = {}) {
  const user = userEvent.setup()
  render(
    <EditDomicilioDialog
      domicilio={domicilio}
      conceptos={conceptos}
      conceptoActual={3}
      trigger={<Button>Abrir</Button>}
      {...props}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

describe('EditDomicilioDialog', () => {
  it('por defecto muestra el tipo de cuota', async () => {
    await abrir()
    expect(screen.getByLabelText('Tipo de Cuota Mensual')).toBeInTheDocument()
  })

  it('con editarTipoCuota={false} oculta el campo y llama a la acción recibida sin conceptoId', async () => {
    const actualizar = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const user = await abrir({ actualizar, editarTipoCuota: false })
    expect(screen.queryByLabelText('Tipo de Cuota Mensual')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(actualizar).toHaveBeenCalledTimes(1)
    const [id, input] = actualizar.mock.calls[0]
    expect(id).toBe(5)
    expect(input).not.toHaveProperty('conceptoId')
    expect(input).toMatchObject({ direccion: 'LAGO 1', fechaAlta: '2026-01-01' })
    const { actualizarDomicilio } = await import('../actions')
    expect(actualizarDomicilio).not.toHaveBeenCalled()
  })

  describe('aviso al quitar medios', () => {
    const tipos = [
      { id: 3, nombre: 'Completo', importe: 100 },
      { id: 4, nombre: 'Básico', importe: 50 },
      { id: 5, nombre: 'Tarjetas', importe: 80 },
    ] as never
    const mediosPorConcepto = { 3: ['tarjeta', 'control', 'telefono'], 4: ['telefono'], 5: ['tarjeta'] } as const
    const props = {
      conceptos: tipos,
      conceptoActual: 3,
      mediosPorConcepto: mediosPorConcepto as never,
      registros: { tarjeta: 2, control: 1 },
    }

    async function elegir(user: Awaited<ReturnType<typeof abrir>>, nombre: string) {
      await user.click(screen.getByRole('combobox'))
      await user.click(screen.getByRole('option', { name: new RegExp(nombre) }))
    }

    it('avisa con los conteos exactos cuando el tipo nuevo quita medios con registros', async () => {
      const user = await abrir(props)
      expect(screen.queryByText(/Se ocultarán/)).not.toBeInTheDocument()
      await elegir(user, 'Básico')
      expect(
        screen.getByText('Se ocultarán 2 tarjetas y 1 control y se darán de baja en access-core'),
      ).toBeInTheDocument()
    })

    it('solo cuenta lo que se oculta', async () => {
      const user = await abrir(props)
      await elegir(user, 'Tarjetas')
      expect(screen.getByText('Se ocultará 1 control y se dará de baja en access-core')).toBeInTheDocument()
    })

    it('sin registros afectados no avisa', async () => {
      const user = await abrir({ ...props, registros: { tarjeta: 0, control: 0 } })
      await elegir(user, 'Básico')
      expect(screen.queryByText(/Se ocultar/)).not.toBeInTheDocument()
    })
  })
})
