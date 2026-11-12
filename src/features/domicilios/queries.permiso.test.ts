import { describe, expect, it, vi } from 'vitest'
import { fakeQuery, fakeSupabase } from '@/test/fake-query'
import { getPermisoDomicilio } from './queries'

const ACCESO = {
  perfil_corriente_id: 'p-corr',
  perfil_corriente_nombre: 'Residentes',
  perfil_moroso_id: 'p-mor',
  perfil_moroso_nombre: 'Morosos',
}

function cliente(opts: { asignado?: string | null; instalacion?: string | null; deseado?: string | null } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: opts.deseado === undefined ? 'p-corr' : opts.deseado, error: null })
  const sb = fakeSupabase(
    {
      domicilios: fakeQuery({
        data: { perfil_asignado_id: opts.asignado === undefined ? 'p-corr' : opts.asignado, fraccionamiento_id: 7 },
      }),
      fraccionamientos: fakeQuery({
        data: { instalacion_id: opts.instalacion === undefined ? 'inst-1' : opts.instalacion },
      }),
      domicilio_concepto: fakeQuery({ data: { concepto_id: 3 } }),
      concepto_pago_acceso: fakeQuery({ data: ACCESO }),
    },
    { rpc },
  )
  return { sb: sb as never, rpc }
}

describe('getPermisoDomicilio', () => {
  it('nombra el permiso asignado según los perfiles del tipo de cuota', async () => {
    const { sb, rpc } = cliente({ asignado: 'p-mor', deseado: 'p-mor' })
    expect(await getPermisoDomicilio(sb, 5)).toEqual({ nombre: 'Morosos', pendiente: false })
    expect(rpc).toHaveBeenCalledWith('perfil_deseado', { p_domicilio_id: 5 })
  })

  it('pendiente cuando el deseado difiere del asignado', async () => {
    const { sb } = cliente({ asignado: 'p-corr', deseado: 'p-mor' })
    expect(await getPermisoDomicilio(sb, 5)).toEqual({ nombre: 'Residentes', pendiente: true })
  })

  it('sin permiso asignado el nombre es nulo', async () => {
    const { sb } = cliente({ asignado: null, deseado: null })
    expect(await getPermisoDomicilio(sb, 5)).toEqual({ nombre: null, pendiente: false })
  })

  it('sin instalación devuelve null', async () => {
    const { sb, rpc } = cliente({ instalacion: null })
    expect(await getPermisoDomicilio(sb, 5)).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})
