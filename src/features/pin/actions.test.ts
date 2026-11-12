import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { AccessCoreError, AccessCoreNoConfigurado, fijarPin, generarPin, quitarPin } from '@/lib/access-core'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { fijarPinDomicilio, generarPinDomicilio, quitarPinDomicilio } from './actions'
import { MSG_ACCESS_CORE_NO_CONFIGURADO, MSG_PIN_SIN_SINCRONIZAR } from './messages'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/features/sincronizacion/cola', () => ({ instalacionDe: vi.fn() }))
vi.mock('@/lib/access-core', async () => ({
  ...(await import('@/lib/access-core/errores')),
  fijarPin: vi.fn(),
  generarPin: vi.fn(),
  quitarPin: vi.fn(),
}))

const user = { id: 'u1', email: 'a@b.c', userName: 'Ana', roleName: 'tesorero', isActive: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  vi.mocked(instalacionDe).mockResolvedValue({ fid: 7, instalacionId: 'inst-1' })
  vi.mocked(fijarPin).mockResolvedValue(undefined)
  vi.mocked(generarPin).mockResolvedValue('482913')
  vi.mocked(quitarPin).mockResolvedValue(undefined)
})

function usar(titular: string | null = 'tit-1') {
  const domicilio = fakeQuery({ data: { titular_id: titular, fraccionamiento_id: 7 } })
  const pines = fakeQuery()
  vi.mocked(createClient).mockResolvedValue(fakeSupabase({ domicilios: domicilio, pines_acceso: pines }) as never)
  return { domicilio, pines }
}

describe('fijarPinDomicilio', () => {
  test('llama a la API con el titular y guarda el PIN', async () => {
    const { pines, domicilio } = usar()
    expect(await fijarPinDomicilio(9, '1234')).toEqual({ ok: true, data: undefined })
    expect(callsOf(domicilio, 'eq')[0].args).toEqual(['id', 9])
    expect(instalacionDe).toHaveBeenCalledWith(expect.anything(), 7)
    expect(fijarPin).toHaveBeenCalledWith('inst-1', 'tit-1', '1234')
    const [fila, opciones] = callsOf(pines, 'upsert')[0].args as [Record<string, unknown>, unknown]
    expect(fila).toMatchObject({ domicilio_id: 9, fraccionamiento_id: 7, pin: '1234' })
    expect(opciones).toEqual({ onConflict: 'domicilio_id' })
    expect(revalidatePath).toHaveBeenCalledWith('/domicilios/9')
  })

  test('con 409 devuelve el mensaje de la API y no escribe', async () => {
    const { pines } = usar()
    vi.mocked(fijarPin).mockRejectedValue(new AccessCoreError(409, 'conflict', 'El PIN ya está en uso en esta instalación'))
    expect(await fijarPinDomicilio(9, '1234')).toEqual({ ok: false, error: 'El PIN ya está en uso en esta instalación' })
    expect(pines.calls).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('sin titular → "El domicilio aún no está sincronizado" sin llamar a la API', async () => {
    const { pines } = usar(null)
    expect(await fijarPinDomicilio(9, '1234')).toEqual({ ok: false, error: 'El domicilio aún no está sincronizado' })
    expect(MSG_PIN_SIN_SINCRONIZAR).toBe('El domicilio aún no está sincronizado')
    expect(fijarPin).not.toHaveBeenCalled()
    expect(pines.calls).toHaveLength(0)
  })

  test('sin llave de access-core → "access-core no está configurado"', async () => {
    usar()
    vi.mocked(fijarPin).mockRejectedValue(new AccessCoreNoConfigurado())
    expect(await fijarPinDomicilio(9, '1234')).toEqual({ ok: false, error: 'access-core no está configurado' })
    expect(MSG_ACCESS_CORE_NO_CONFIGURADO).toBe('access-core no está configurado')
  })

  test('rechaza un PIN que no tiene de 4 a 6 dígitos sin tocar la base', async () => {
    expect(await fijarPinDomicilio(9, '12a4')).toEqual({ ok: false, error: 'El PIN debe tener de 4 a 6 dígitos' })
    expect(await fijarPinDomicilio(9, '1234567')).toEqual({ ok: false, error: 'El PIN debe tener de 4 a 6 dígitos' })
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('generarPinDomicilio', () => {
  test('guarda el PIN que devolvió la API y lo regresa', async () => {
    const { pines } = usar()
    expect(await generarPinDomicilio(9)).toEqual({ ok: true, data: { pin: '482913' } })
    expect(generarPin).toHaveBeenCalledWith('inst-1', 'tit-1')
    expect(callsOf(pines, 'upsert')[0].args[0]).toMatchObject({ domicilio_id: 9, pin: '482913' })
  })

  test('sin titular → mensaje exacto', async () => {
    usar(null)
    expect(await generarPinDomicilio(9)).toEqual({ ok: false, error: 'El domicilio aún no está sincronizado' })
    expect(generarPin).not.toHaveBeenCalled()
  })
})

describe('quitarPinDomicilio', () => {
  test('quita el PIN en la API y borra la fila', async () => {
    const { pines } = usar()
    expect((await quitarPinDomicilio(9)).ok).toBe(true)
    expect(quitarPin).toHaveBeenCalledWith('inst-1', 'tit-1')
    expect(callsOf(pines, 'delete')).toHaveLength(1)
    expect(callsOf(pines, 'eq')[0].args).toEqual(['domicilio_id', 9])
  })

  test('si la API falla no borra la fila', async () => {
    const { pines } = usar()
    vi.mocked(quitarPin).mockRejectedValue(new AccessCoreError(0, 'network', 'access-core no respondió, inténtalo más tarde'))
    expect(await quitarPinDomicilio(9)).toEqual({ ok: false, error: 'access-core no respondió, inténtalo más tarde' })
    expect(pines.calls).toHaveLength(0)
  })
})

describe('permisos', () => {
  test.each(['comite', 'vigilancia'])('%s no puede gestionar el PIN', async (rol) => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, roleName: rol } as never)
    expect(await fijarPinDomicilio(9, '1234')).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await generarPinDomicilio(9)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(await quitarPinDomicilio(9)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createClient).not.toHaveBeenCalled()
  })
})
