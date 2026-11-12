import { redirect } from 'next/navigation'
import { ok } from '@/lib/action-result'
import { getCurrentUser, getTenantContext, type CurrentUser, type TenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { fakeQuery, fakeSupabase } from '@/test/fake-query'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/auth/tenant-context')>()
  return { ...real, getCurrentUser: vi.fn(real.getCurrentUser), getTenantContext: vi.fn(real.getTenantContext) }
})

import { MSG_ERROR, MSG_NO_PERMISO, MSG_SESION, runAction, runSuperAdminAction } from '@/lib/auth/run-action'

const COMITE: CurrentUser = {
  id: 'u1',
  email: 'comite@lago.mx',
  userName: 'Comité',
  roleName: 'comite',
  isActive: true,
  fraccionamientoId: 7,
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset()
})

test('sin sesión devuelve MSG_SESION sin lanzar', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null)
  const fn = vi.fn()

  const result = await runAction(null, fn)

  expect(result).toEqual({ ok: false, error: MSG_SESION })
  expect(fn).not.toHaveBeenCalled()
})

test('usuario inactivo devuelve MSG_SESION', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ ...COMITE, isActive: false })
  const fn = vi.fn()

  const result = await runAction(['comite'], fn)

  expect(result).toEqual({ ok: false, error: MSG_SESION })
  expect(fn).not.toHaveBeenCalled()
})

test('contexto sin_acceso (perfil activo, fraccionamiento oculto por RLS) devuelve MSG_SESION', async () => {
  // Contexto real: el perfil existe y está activo, pero su fraccionamiento no es visible.
  const real = await vi.importActual<typeof import('@/lib/auth/tenant-context')>('@/lib/auth/tenant-context')
  vi.mocked(getCurrentUser).mockImplementation(real.getCurrentUser)
  const getClaims = vi.fn().mockResolvedValue({ data: { claims: { sub: 'u1', email: 'a@lago.mx' } }, error: null })
  vi.mocked(createClient).mockResolvedValue(
    fakeSupabase(
      {
        perfiles: fakeQuery({
          data: { id: 'u1', fraccionamiento_id: 7, rol: 'administrador', nombre: 'Ana', email: 'a@lago.mx', activo: true },
        }),
        fraccionamientos: fakeQuery({ data: null }),
      },
      { auth: { getClaims } },
    ) as never,
  )
  expect(real.estadoAcceso((await real.getTenantContext())!)).toBe('sin_acceso')
  const fn = vi.fn()

  const result = await runAction(['administrador'], fn)

  expect(result).toEqual({ ok: false, error: MSG_SESION })
  expect(fn).not.toHaveBeenCalled()
})

test('rol no permitido devuelve MSG_NO_PERMISO', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(COMITE)
  const fn = vi.fn()

  const result = await runAction(['administrador'], fn)

  expect(result).toEqual({ ok: false, error: MSG_NO_PERMISO })
  expect(fn).not.toHaveBeenCalled()
})

test('rol permitido ejecuta fn con el usuario', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(COMITE)

  const result = await runAction(['administrador', 'comite'], async (user) => ok(user.id))

  expect(result).toEqual({ ok: true, data: 'u1' })
})

test('roles null solo exige sesión', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ ...COMITE, roleName: null })

  const result = await runAction(null, async (user) => ok(user.email))

  expect(result).toEqual({ ok: true, data: 'comite@lago.mx' })
})

test('excepción inesperada devuelve MSG_ERROR', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(COMITE)
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const boom = new Error('boom')

  const result = await runAction(null, async () => {
    throw boom
  })

  expect(result).toEqual({ ok: false, error: MSG_ERROR })
  expect(consoleError).toHaveBeenCalledWith(boom)
  consoleError.mockRestore()
})

test('deja propagar redirect() de Next.js', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(COMITE)

  await expect(runAction(null, async () => redirect('/login'))).rejects.toThrow('NEXT_REDIRECT')
})


describe('runSuperAdminAction', () => {
  const SUPER: TenantContext = {
    userId: 'u0',
    email: 'root@plataforma.mx',
    perfil: { nombre: 'Root', email: 'root@plataforma.mx', rol: 'super_admin', activo: true, fraccionamientoId: null },
    fraccionamiento: null,
  }
  const ADMIN: TenantContext = {
    ...SUPER,
    userId: 'u1',
    perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 7 },
    fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
  }

  beforeEach(() => {
    vi.mocked(getTenantContext).mockReset()
  })

  test('administrador de fraccionamiento devuelve MSG_NO_PERMISO sin llamar fn', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const fn = vi.fn()

    expect(await runSuperAdminAction(fn)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(fn).not.toHaveBeenCalled()
  })

  test('super admin inactivo devuelve MSG_NO_PERMISO', async () => {
    vi.mocked(getTenantContext).mockResolvedValue({ ...SUPER, perfil: { ...SUPER.perfil!, activo: false } })
    const fn = vi.fn()

    expect(await runSuperAdminAction(fn)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(fn).not.toHaveBeenCalled()
  })

  test('sin sesión devuelve MSG_SESION', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(null)
    const fn = vi.fn()

    expect(await runSuperAdminAction(fn)).toEqual({ ok: false, error: MSG_SESION })
    expect(fn).not.toHaveBeenCalled()
  })

  test('super admin ejecuta fn con su id y email', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(SUPER)

    const result = await runSuperAdminAction(async (admin) => ok(admin))

    expect(result).toEqual({ ok: true, data: { id: 'u0', email: 'root@plataforma.mx' } })
  })

  test('excepción inesperada devuelve MSG_ERROR', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(SUPER)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await runSuperAdminAction(async () => {
      throw new Error('boom')
    })

    expect(result).toEqual({ ok: false, error: MSG_ERROR })
    consoleError.mockRestore()
  })

  test('deja propagar redirect() de Next.js', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(SUPER)

    await expect(runSuperAdminAction(async () => redirect('/admin'))).rejects.toThrow('NEXT_REDIRECT')
  })
})
