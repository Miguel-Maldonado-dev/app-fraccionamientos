import { beforeEach, describe, expect, test, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getTenantContext, type TenantContext } from '@/lib/auth/tenant-context'
import { MSG_ERROR, MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { callsOf, fakeQuery, fakeSupabase, type FakeQuery } from '@/test/fake-query'
import { MSG_EMAIL_DUPLICADO } from '@/features/usuarios/messages'
import { MSG_FRACCIONAMIENTO_NO_EXISTE, MSG_USUARIO_NO_EXISTE } from './messages'
import { cambiarEstadoUsuarioEnFraccionamiento, crearUsuarioEnFraccionamiento } from './usuarios-actions'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
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

const input = { userName: 'ana lopez', email: 'ana@lago.mx', password: '123456', rol: 'administrador' as const }
const FRACC = { id: 5, nombre: 'Los Pinos', slug: 'los-pinos', activo: true, instalacion_id: null, perfiles: [], domicilios: [] }

function usarFraccionamiento(data: unknown) {
  const fraccionamientos = fakeQuery({ data })
  const sb = fakeSupabase({ fraccionamientos })
  vi.mocked(createClient).mockResolvedValue(sb as never)
  return sb
}

function fakeAdmin({
  createUser = { data: { user: { id: 'nuevo-id' } }, error: null } as unknown,
  perfiles = fakeQuery({}) as FakeQuery,
} = {}) {
  const admin = {
    createUser: vi.fn().mockResolvedValue(createUser),
    deleteUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  }
  vi.mocked(createAdminClient).mockReturnValue(fakeSupabase({ perfiles }, { auth: { admin } }) as never)
  return { admin, perfiles }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTenantContext).mockResolvedValue(SUPER)
})

describe('crearUsuarioEnFraccionamiento', () => {
  test('un administrador → MSG_NO_PERMISO sin tocar el cliente admin', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    usarFraccionamiento(FRACC)
    expect(await crearUsuarioEnFraccionamiento(5, input)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  test('el super admin crea el usuario en el fraccionamiento del parámetro', async () => {
    usarFraccionamiento(FRACC)
    const f = fakeAdmin()
    expect(await crearUsuarioEnFraccionamiento(5, input)).toEqual({ ok: true, data: undefined })
    expect(f.admin.createUser).toHaveBeenCalledWith({ email: 'ana@lago.mx', password: '123456', email_confirm: true })
    expect(callsOf(f.perfiles, 'insert')[0].args).toEqual([
      { id: 'nuevo-id', fraccionamiento_id: 5, rol: 'administrador', nombre: 'Ana Lopez', email: 'ana@lago.mx' },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/5')
  })

  test('fraccionamiento inexistente → MSG_FRACCIONAMIENTO_NO_EXISTE sin tocar el cliente admin', async () => {
    usarFraccionamiento(null)
    expect(await crearUsuarioEnFraccionamiento(99, input)).toEqual({ ok: false, error: MSG_FRACCIONAMIENTO_NO_EXISTE })
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('email duplicado → MSG_EMAIL_DUPLICADO', async () => {
    usarFraccionamiento(FRACC)
    const f = fakeAdmin({
      createUser: { data: { user: null }, error: { message: 'exists', status: 422, code: 'email_exists' } },
    })
    expect(await crearUsuarioEnFraccionamiento(5, input)).toEqual({ ok: false, error: MSG_EMAIL_DUPLICADO })
    expect(callsOf(f.perfiles, 'insert')).toHaveLength(0)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('otra falla del alta → MSG_ERROR', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    usarFraccionamiento(FRACC)
    fakeAdmin({ perfiles: fakeQuery({ error: { message: 'insert falló' } }) })
    expect(await crearUsuarioEnFraccionamiento(5, input)).toEqual({ ok: false, error: MSG_ERROR })
    consoleError.mockRestore()
  })

  test('datos inválidos no tocan el cliente admin', async () => {
    usarFraccionamiento(FRACC)
    expect(await crearUsuarioEnFraccionamiento(5, { ...input, password: '123' })).toEqual({
      ok: false,
      error: 'Mínimo 6 caracteres',
    })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})

describe('cambiarEstadoUsuarioEnFraccionamiento', () => {
  const usarPerfiles = (q: FakeQuery) => {
    const sb = fakeSupabase({ perfiles: q })
    vi.mocked(createClient).mockResolvedValue(sb as never)
    return sb
  }

  test('actualiza activo filtrando por id y fraccionamiento_id', async () => {
    const q = fakeQuery({ data: [{ id: 'u9' }] })
    usarPerfiles(q)
    expect(await cambiarEstadoUsuarioEnFraccionamiento(5, 'u9', false)).toEqual({ ok: true, data: undefined })
    expect(callsOf(q, 'update')[0].args).toEqual([{ activo: false }])
    expect(callsOf(q, 'eq').map((c) => c.args)).toEqual([
      ['id', 'u9'],
      ['fraccionamiento_id', 5],
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/5')
  })

  test('0 filas afectadas → mensaje de usuario inexistente', async () => {
    usarPerfiles(fakeQuery({ data: [] }))
    expect(MSG_USUARIO_NO_EXISTE).toBe('El usuario ya no existe. Recarga la página.')
    expect(await cambiarEstadoUsuarioEnFraccionamiento(5, 'u9', true)).toEqual({
      ok: false,
      error: 'El usuario ya no existe. Recarga la página.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('un administrador → MSG_NO_PERMISO sin escribir', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN)
    const sb = usarPerfiles(fakeQuery({ data: [{ id: 'u9' }] }))
    expect(await cambiarEstadoUsuarioEnFraccionamiento(5, 'u9', false)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(sb.from).not.toHaveBeenCalled()
  })
})
