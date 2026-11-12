import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getTenantContext, type TenantContext } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { MSG_MEDIO_EN_USO, MSG_MEDIO_NO_DISPONIBLE } from './messages'
import { guardarMediosDeFraccionamiento } from './medios-actions'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
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
const ADMIN: TenantContext = {
  ...SUPER,
  perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 7 },
  fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
}

const usar = (q: ReturnType<typeof fakeQuery> | ReturnType<typeof fakeQuery>[]) => {
  const sb = fakeSupabase({ fraccionamiento_medios: q })
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return sb
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTenantContext).mockResolvedValue(SUPER)
})

describe('guardarMediosDeFraccionamiento', () => {
  test('borra los que sobran, inserta los que faltan y revalida', async () => {
    const q = fakeQuery({ data: [{ medio: 'tarjeta' }, { medio: 'pin' }] })
    usar(q)
    const r = await guardarMediosDeFraccionamiento(4, ['tarjeta', 'control'])
    expect(r).toEqual({ ok: true, data: undefined })
    expect(callsOf(q, 'delete')).toHaveLength(1)
    expect(callsOf(q, 'in')[0].args).toEqual(['medio', ['pin']])
    expect(callsOf(q, 'insert')[0].args).toEqual([[{ fraccionamiento_id: 4, medio: 'control' }]])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/4')
  })

  test('sin cambios no borra ni inserta', async () => {
    const q = fakeQuery({ data: [{ medio: 'tarjeta' }] })
    usar(q)
    expect(await guardarMediosDeFraccionamiento(4, ['tarjeta'])).toEqual({ ok: true, data: undefined })
    expect(callsOf(q, 'delete')).toHaveLength(0)
    expect(callsOf(q, 'insert')).toHaveLength(0)
  })

  test('qr se rechaza sin tocar la base', async () => {
    const sb = usar(fakeQuery())
    expect(await guardarMediosDeFraccionamiento(4, ['tarjeta', 'qr'])).toEqual({ ok: false, error: MSG_MEDIO_NO_DISPONIBLE })
    expect(sb.from).not.toHaveBeenCalled()
  })

  test('23503 al borrar → mensaje de medio en uso', async () => {
    usar([
      fakeQuery({ data: [{ medio: 'pin' }] }),
      fakeQuery({ error: { code: '23503', message: 'Hay tipos de cuota que usan este medio' } }),
    ])
    expect(await guardarMediosDeFraccionamiento(4, [])).toEqual({ ok: false, error: MSG_MEDIO_EN_USO })
  })

  test('administrador de fraccionamiento → MSG_NO_PERMISO', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const sb = usar(fakeQuery())
    expect(await guardarMediosDeFraccionamiento(4, ['tarjeta'])).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(sb.from).not.toHaveBeenCalled()
  })
})
