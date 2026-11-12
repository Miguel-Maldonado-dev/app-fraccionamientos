import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import {
  estadoAcceso,
  getCurrentUser,
  getTenantContext,
  type Perfil,
  type TenantContext,
} from '@/lib/auth/tenant-context'

const ADMIN: Perfil = {
  nombre: 'Ana',
  email: 'ana@lago.mx',
  rol: 'administrador',
  activo: true,
  fraccionamientoId: 7,
}

const ctx = (over: Partial<TenantContext> = {}): TenantContext => ({
  userId: 'u1',
  email: 'ana@lago.mx',
  perfil: ADMIN,
  fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
  ...over,
})

function mockSupabase(
  claims: Record<string, unknown> | null,
  tables: { perfiles?: FakeQuery; fraccionamientos?: FakeQuery } = {},
) {
  const getClaims = vi.fn().mockResolvedValue({ data: claims ? { claims } : null, error: null })
  const supabase = fakeSupabase(
    {
      perfiles: tables.perfiles ?? fakeQuery({ data: null }),
      fraccionamientos: tables.fraccionamientos ?? fakeQuery({ data: null }),
    },
    { auth: { getClaims } },
  )
  vi.mocked(createClient).mockResolvedValue(supabase as never)
  return supabase
}

const perfilRow = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  fraccionamiento_id: 7,
  rol: 'administrador',
  nombre: 'Ana',
  email: 'ana@lago.mx',
  activo: true,
  ...over,
})

describe('estadoAcceso', () => {
  it('sin perfil → sin_acceso', () => {
    expect(estadoAcceso(ctx({ perfil: null, fraccionamiento: null }))).toBe('sin_acceso')
  })

  it('perfil inactivo → sin_acceso', () => {
    expect(estadoAcceso(ctx({ perfil: { ...ADMIN, activo: false } }))).toBe('sin_acceso')
  })

  it('administrador con fraccionamiento null (inactivo u oculto por RLS) → sin_acceso', () => {
    expect(estadoAcceso(ctx({ fraccionamiento: null }))).toBe('sin_acceso')
  })

  it('administrador con fraccionamiento → app', () => {
    expect(estadoAcceso(ctx())).toBe('app')
  })

  it('super admin activo → super_admin', () => {
    const perfil: Perfil = { ...ADMIN, rol: 'super_admin', fraccionamientoId: null }
    expect(estadoAcceso(ctx({ perfil, fraccionamiento: null }))).toBe('super_admin')
  })

  it('super admin inactivo → sin_acceso', () => {
    const perfil: Perfil = { ...ADMIN, rol: 'super_admin', activo: false, fraccionamientoId: null }
    expect(estadoAcceso(ctx({ perfil, fraccionamiento: null }))).toBe('sin_acceso')
  })
})

describe('getTenantContext', () => {
  it('sin claims devuelve null sin consultar', async () => {
    const supabase = mockSupabase(null)

    expect(await getTenantContext()).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('perfil + fraccionamiento → contexto completo', async () => {
    const perfiles = fakeQuery({ data: perfilRow() })
    const fraccionamientos = fakeQuery({ data: { id: 7, nombre: 'Fracc Demo' } })
    mockSupabase({ sub: 'u1', email: 'ana@lago.mx' }, { perfiles, fraccionamientos })

    expect(await getTenantContext()).toEqual({
      userId: 'u1',
      email: 'ana@lago.mx',
      perfil: ADMIN,
      fraccionamiento: { id: 7, nombre: 'Fracc Demo' },
    })
    expect(callsOf(perfiles, 'eq')).toEqual([{ method: 'eq', args: ['id', 'u1'] }])
    expect(callsOf(fraccionamientos, 'select')).toEqual([{ method: 'select', args: ['id, nombre'] }])
    expect(callsOf(fraccionamientos, 'eq')).toEqual([{ method: 'eq', args: ['id', 7] }])
    expect(callsOf(fraccionamientos, 'maybeSingle')).toHaveLength(1)
  })

  it('perfil sin fila visible de fraccionamiento → fraccionamiento null', async () => {
    mockSupabase(
      { sub: 'u1', email: 'ana@lago.mx' },
      { perfiles: fakeQuery({ data: perfilRow() }), fraccionamientos: fakeQuery({ data: null }) },
    )

    const result = await getTenantContext()

    expect(result?.perfil).toEqual(ADMIN)
    expect(result?.fraccionamiento).toBeNull()
  })

  it('super admin sin fraccionamiento_id no consulta fraccionamientos', async () => {
    const supabase = mockSupabase(
      { sub: 'u1', email: 'ana@lago.mx' },
      { perfiles: fakeQuery({ data: perfilRow({ rol: 'super_admin', fraccionamiento_id: null }) }) },
    )

    const result = await getTenantContext()

    expect(result?.fraccionamiento).toBeNull()
    expect(supabase.from).not.toHaveBeenCalledWith('fraccionamientos')
  })

  it('sin perfil → perfil null y email de los claims', async () => {
    mockSupabase({ sub: 'u2', email: 'beto@lago.mx' })

    expect(await getTenantContext()).toEqual({
      userId: 'u2',
      email: 'beto@lago.mx',
      perfil: null,
      fraccionamiento: null,
    })
  })

  it('un error al leer perfiles lanza Error', async () => {
    mockSupabase({ sub: 'u1' }, { perfiles: fakeQuery({ error: { message: 'timeout' } }) })

    await expect(getTenantContext()).rejects.toThrow('timeout')
  })

  it('un error al leer fraccionamientos lanza Error', async () => {
    mockSupabase(
      { sub: 'u1' },
      {
        perfiles: fakeQuery({ data: perfilRow() }),
        fraccionamientos: fakeQuery({ error: { message: 'boom' } }),
      },
    )

    await expect(getTenantContext()).rejects.toThrow('boom')
  })
})

describe('getCurrentUser', () => {
  it('miembro activo con fraccionamiento: activo y con rol', async () => {
    mockSupabase(
      { sub: 'u1', email: 'ana@lago.mx' },
      {
        perfiles: fakeQuery({ data: perfilRow({ rol: 'tesorero' }) }),
        fraccionamientos: fakeQuery({ data: { id: 7, nombre: 'Fracc Demo' } }),
      },
    )

    expect(await getCurrentUser()).toEqual({
      id: 'u1',
      email: 'ana@lago.mx',
      userName: 'Ana',
      roleName: 'tesorero',
      isActive: true,
      fraccionamientoId: 7,
    })
  })

  it('fraccionamiento oculto (inactivo) → isActive false', async () => {
    mockSupabase({ sub: 'u1', email: 'ana@lago.mx' }, { perfiles: fakeQuery({ data: perfilRow() }) })

    expect((await getCurrentUser())?.isActive).toBe(false)
  })

  it('super admin: roleName null e isActive false dentro de la app', async () => {
    mockSupabase(
      { sub: 'u1', email: 'ana@lago.mx' },
      { perfiles: fakeQuery({ data: perfilRow({ rol: 'super_admin', fraccionamiento_id: null }) }) },
    )

    const user = await getCurrentUser()

    expect(user?.roleName).toBeNull()
    expect(user?.isActive).toBe(false)
    expect(user?.fraccionamientoId).toBeNull()
  })

  it('sin perfil: usuario vacío e inactivo', async () => {
    mockSupabase({ sub: 'u2', email: 'beto@lago.mx' })

    expect(await getCurrentUser()).toEqual({
      id: 'u2',
      email: 'beto@lago.mx',
      userName: '',
      roleName: null,
      isActive: false,
      fraccionamientoId: null,
    })
  })

  it('sin sesión → null', async () => {
    mockSupabase(null)

    expect(await getCurrentUser()).toBeNull()
  })
})
