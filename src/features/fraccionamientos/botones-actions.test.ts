import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getTenantContext, type TenantContext } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { encolar } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { guardarBotonesDeFraccionamiento } from './botones-actions'
import { MSG_FRACCIONAMIENTO_NO_EXISTE } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ encolar: vi.fn() }))
vi.mock('@/features/sincronizacion/disparar', () => ({ dispararSincronizacion: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getTenantContext: vi.fn(),
}))

const SUPER: TenantContext = {
  userId: 'u0',
  email: 'root@plataforma.mx',
  perfil: { nombre: 'Root', email: 'root@plataforma.mx', rol: 'super_admin', activo: true, fraccionamientoId: null },
  fraccionamiento: null,
}
const P1 = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const P2 = '9a1b2c3d-4e5f-41a2-8b3c-0123456789ab'
const b0 = { boton: 0 as const, panelId: P1, panelCodigo: 'PNL-1', salida: 0 as const, salidaAlias: 'Portón' }
const b1 = { boton: 1 as const, panelId: P1, panelCodigo: 'PNL-1', salida: 1 as const, salidaAlias: 'Puerta' }
const fila = (b: { boton: number; panelId: string; panelCodigo: string; salida: number; salidaAlias: string }) => ({
  boton: b.boton,
  panel_id: b.panelId,
  panel_codigo: b.panelCodigo,
  salida: b.salida,
  salida_alias: b.salidaAlias,
})

function usar(opts: {
  instalacion?: string | null
  existentes?: ReturnType<typeof fila>[]
  controles?: { id: number; domicilio_id: number; botones: { boton: number }[] }[]
  fracc?: unknown
}) {
  const fracc = fakeQuery({
    data: opts.fracc === undefined ? { instalacion_id: opts.instalacion === undefined ? P2 : opts.instalacion } : opts.fracc,
  })
  const botones = fakeQuery({ data: opts.existentes ?? [] })
  const controles = fakeQuery({ data: opts.controles ?? [] })
  const sb = fakeSupabase({ fraccionamientos: fracc, fraccionamiento_botones: botones, controles_acceso: controles })
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return { sb, botones, controles }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTenantContext).mockResolvedValue(SUPER)
})

describe('guardarBotonesDeFraccionamiento', () => {
  test('hace upsert de los botones nuevos y encola control actualizar solo de los controles afectados', async () => {
    const { botones } = usar({
      existentes: [fila(b0)],
      controles: [
        { id: 20, domicilio_id: 8, botones: [{ boton: 0 }, { boton: 1 }] },
        { id: 21, domicilio_id: 9, botones: [{ boton: 0 }] },
      ],
    })
    const r = await guardarBotonesDeFraccionamiento(4, [b0, b1])
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(botones, 'upsert')[0].args).toEqual([[{ fraccionamiento_id: 4, ...fila(b1) }], { onConflict: 'fraccionamiento_id,boton' }])
    expect(callsOf(botones, 'delete')).toHaveLength(0)
    expect(vi.mocked(encolar).mock.calls[0][1]).toEqual([
      { fraccionamientoId: 4, domicilioId: 8, entidad: 'control', entidadId: 20, operacion: 'actualizar' },
    ])
    expect(dispararSincronizacion).toHaveBeenCalledWith(4)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/4')
  })

  test('un botón que se quita se borra y también cuenta como cambiado', async () => {
    const { botones } = usar({
      existentes: [fila(b0), fila(b1)],
      controles: [{ id: 21, domicilio_id: 9, botones: [{ boton: 1 }] }],
    })
    await guardarBotonesDeFraccionamiento(4, [b0])
    expect(callsOf(botones, 'in')[0].args).toEqual(['boton', [1]])
    expect(callsOf(botones, 'upsert')).toHaveLength(0)
    expect(vi.mocked(encolar).mock.calls[0][1]).toHaveLength(1)
  })

  test('un botón que cambia de salida cuenta como cambiado', async () => {
    const { botones } = usar({ existentes: [fila(b0)], controles: [{ id: 21, domicilio_id: 9, botones: [{ boton: 0 }] }] })
    await guardarBotonesDeFraccionamiento(4, [{ ...b0, salida: 3, salidaAlias: 'Otra' }])
    expect(callsOf(botones, 'upsert')).toHaveLength(1)
    expect(encolar).toHaveBeenCalled()
  })

  test('sin cambios no escribe, no encola ni dispara', async () => {
    const { botones } = usar({ existentes: [fila(b0)], controles: [{ id: 21, domicilio_id: 9, botones: [{ boton: 0 }] }] })
    expect(await guardarBotonesDeFraccionamiento(4, [b0])).toEqual({ ok: true, data: undefined })
    expect(callsOf(botones, 'upsert')).toHaveLength(0)
    expect(callsOf(botones, 'delete')).toHaveLength(0)
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('sin instalación guarda pero no encola', async () => {
    usar({ instalacion: null })
    expect(await guardarBotonesDeFraccionamiento(4, [b0])).toEqual({ ok: true, data: undefined })
    expect(encolar).not.toHaveBeenCalled()
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('fraccionamiento inexistente', async () => {
    usar({ fracc: null })
    expect(await guardarBotonesDeFraccionamiento(4, [b0])).toEqual({ ok: false, error: MSG_FRACCIONAMIENTO_NO_EXISTE })
  })

  test('botón repetido o fuera de rango → fail sin tocar la base', async () => {
    const { sb } = usar({})
    expect((await guardarBotonesDeFraccionamiento(4, [b0, b0])).ok).toBe(false)
    expect((await guardarBotonesDeFraccionamiento(4, [{ ...b0, boton: 4 as never }])).ok).toBe(false)
    expect((await guardarBotonesDeFraccionamiento(4, [{ ...b0, panelId: 'x' }])).ok).toBe(false)
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('un administrador → MSG_NO_PERMISO', async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...SUPER,
      perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 4 },
      fraccionamiento: { id: 4, nombre: 'X' },
    })
    const { sb } = usar({})
    expect(await guardarBotonesDeFraccionamiento(4, [b0])).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('si encolar falla no escribe ninguna fila ni dispara', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(encolar).mockRejectedValueOnce(new Error('cola caída'))
    const { botones } = usar({
      existentes: [fila(b0), fila(b1)],
      controles: [{ id: 20, domicilio_id: 8, botones: [{ boton: 0 }] }],
    })
    const r = await guardarBotonesDeFraccionamiento(4, [{ ...b0, salida: 3 }])
    expect(r.ok).toBe(false)
    expect(callsOf(botones, 'upsert')).toHaveLength(0)
    expect(callsOf(botones, 'delete')).toHaveLength(0)
    expect(dispararSincronizacion).not.toHaveBeenCalled()
  })

  test('encola antes de escribir y el upsert va antes del borrado', async () => {
    const { botones } = usar({
      existentes: [fila(b0), fila(b1)],
      controles: [{ id: 20, domicilio_id: 8, botones: [{ boton: 0 }] }],
    })
    await guardarBotonesDeFraccionamiento(4, [{ ...b0, salida: 3 }])
    const orden = botones.calls.map((c) => c.method).filter((m) => m === 'upsert' || m === 'delete')
    expect(orden).toEqual(['upsert', 'delete'])
    expect(vi.mocked(encolar)).toHaveBeenCalledTimes(1)
  })

  test('si la escritura falla tras encolar, el siguiente guardado vuelve a ver el diff', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const controles = [{ id: 20, domicilio_id: 8, botones: [{ boton: 0 }] }]
    const falla = usar({ existentes: [fila(b0)], controles })
    // La lectura y el upsert comparten consulta en el fake: se hace fallar solo el upsert.
    const original = falla.sb.from
    falla.sb.from = vi.fn((t: string) => {
      const q = original(t)
      if (t !== 'fraccionamiento_botones') return q
      return new Proxy(q, {
        get: (target, prop, rcv) =>
          prop === 'upsert' ? () => fakeQuery({ error: { message: 'boom' } }) : Reflect.get(target, prop, rcv),
      })
    }) as never
    expect((await guardarBotonesDeFraccionamiento(4, [{ ...b0, salida: 3 }])).ok).toBe(false)
    expect(encolar).toHaveBeenCalledTimes(1)
    expect(dispararSincronizacion).not.toHaveBeenCalled()

    // Las filas no cambiaron: la nueva petición sigue viendo el cambio y vuelve a encolar.
    usar({ existentes: [fila(b0)], controles })
    expect((await guardarBotonesDeFraccionamiento(4, [{ ...b0, salida: 3 }])).ok).toBe(true)
    expect(encolar).toHaveBeenCalledTimes(2)
    expect(dispararSincronizacion).toHaveBeenCalledWith(4)
  })
})
