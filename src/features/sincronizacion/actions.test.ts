// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, getTenantContext, type TenantContext } from '@/lib/auth/tenant-context'
import { MSG_ERROR, MSG_NO_PERMISO } from '@/lib/auth/run-action'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fakeDb } from '@/test/fake-db'
import { procesarSincronizaciones } from './worker'
import { tarea } from './test-helpers'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('./worker', () => ({ procesarSincronizaciones: vi.fn() }))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getCurrentUser: vi.fn(),
  getTenantContext: vi.fn(),
}))

import {
  procesarAhora,
  procesarAhoraEnFraccionamiento,
  reintentarTarea,
  reintentarTareaEnFraccionamiento,
} from './actions'

const usuario = (roleName: string) => ({ id: 'u1', email: 'a@b.c', userName: 'Ana', roleName, isActive: true, fraccionamientoId: 7 })

const SUPER: TenantContext = {
  userId: 'u0',
  email: 'root@plataforma.mx',
  perfil: { nombre: 'Root', email: 'root@plataforma.mx', rol: 'super_admin', activo: true, fraccionamientoId: null },
  fraccionamiento: null,
}
const ADMIN_CTX: TenantContext = {
  ...SUPER,
  perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 7 },
  fraccionamiento: { id: 7, nombre: 'Demo' },
}

/** `sesion`: lo que RLS deja ver al usuario; `admin`: toda la tabla. */
function bases(visibles: ReturnType<typeof tarea>[], todas = visibles) {
  const sesion = fakeDb({ sincronizaciones_acceso: visibles.map((t) => ({ ...t })) })
  const admin = fakeDb({ sincronizaciones_acceso: todas.map((t) => ({ ...t })) })
  vi.mocked(createClient).mockResolvedValue(sesion.client as never)
  vi.mocked(createAdminClient).mockReturnValue(admin.client as never)
  return { sesion, admin }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(usuario('administrador') as never)
  vi.mocked(getTenantContext).mockResolvedValue(SUPER)
  vi.mocked(procesarSincronizaciones).mockResolvedValue({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 0 })
})

describe('procesarAhora', () => {
  it('informa cuando otro trabajador tenía el lease', async () => {
    vi.mocked(procesarSincronizaciones).mockResolvedValue({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 1 })
    expect(await procesarAhora()).toEqual({ ok: true, data: { omitido: true, procesadas: 0, fallidas: 0, detenidoPor429: false, noConfigurado: false } })
  })


  it('informa cuando access-core no está configurado', async () => {
    vi.mocked(procesarSincronizaciones).mockResolvedValue({ procesadas: 0, fallidas: 0, detenidoPor429: false, omitidos: 0, noConfigurado: true })
    expect(await procesarAhora()).toEqual({ ok: true, data: { omitido: false, procesadas: 0, fallidas: 0, detenidoPor429: false, noConfigurado: true } })
  })

  it('procesa el fraccionamiento del usuario', async () => {
    expect(await procesarAhora()).toEqual({ ok: true, data: { omitido: false, procesadas: 0, fallidas: 0, detenidoPor429: false, noConfigurado: false } })
    expect(procesarSincronizaciones).toHaveBeenCalledWith({ fraccionamientoId: 7 })
    expect(revalidatePath).toHaveBeenCalledWith('/accesos')
  })

  it('rechaza a comité', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(usuario('comite') as never)
    expect(await procesarAhora()).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(procesarSincronizaciones).not.toHaveBeenCalled()
  })
})

describe('reintentarTarea', () => {
  it('vuelve la tarea a pendiente con intentos 0 y dispara el trabajador', async () => {
    const t = tarea({ estado: 'error', intentos: 20, ultimo_error: 'x' })
    const { admin } = bases([t])
    expect(await reintentarTarea(t.id)).toEqual({ ok: true, data: undefined })
    const fila = admin.tablas.sincronizaciones_acceso[0]
    expect(fila).toMatchObject({ estado: 'pendiente', intentos: 0 })
    expect(Date.parse(fila.proximo_intento_at as string)).toBeGreaterThan(Date.parse(t.proximo_intento_at))
    expect(procesarSincronizaciones).toHaveBeenCalledWith({ fraccionamientoId: 7 })
    expect(revalidatePath).toHaveBeenCalledWith('/accesos')
  })

  it('una tarea de otro fraccionamiento no se encuentra y no toca la base', async () => {
    const ajena = tarea({ fraccionamiento_id: 8, estado: 'error' })
    const { admin } = bases([ajena])
    expect(await reintentarTarea(ajena.id)).toEqual({ ok: false, error: MSG_ERROR })
    expect(admin.ops).toHaveLength(0)
    expect(procesarSincronizaciones).not.toHaveBeenCalled()
  })

  it('una tarea que RLS oculta no se encuentra', async () => {
    const oculta = tarea({ estado: 'error' })
    const { admin } = bases([], [oculta])
    expect(await reintentarTarea(oculta.id)).toEqual({ ok: false, error: MSG_ERROR })
    expect(admin.ops).toHaveLength(0)
  })

  it('rechaza a vigilancia', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(usuario('vigilancia') as never)
    expect(await reintentarTarea('t')).toEqual({ ok: false, error: MSG_NO_PERMISO })
  })
})

describe('consola', () => {
  it('procesarAhoraEnFraccionamiento procesa el fraccionamiento indicado', async () => {
    expect(await procesarAhoraEnFraccionamiento(9)).toEqual({ ok: true, data: { omitido: false, procesadas: 0, fallidas: 0, detenidoPor429: false, noConfigurado: false } })
    expect(procesarSincronizaciones).toHaveBeenCalledWith({ fraccionamientoId: 9 })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/fraccionamientos/9')
  })

  it('procesarAhoraEnFraccionamiento rechaza a un administrador', async () => {
    vi.mocked(getTenantContext).mockResolvedValue(ADMIN_CTX)
    expect(await procesarAhoraEnFraccionamiento(9)).toEqual({ ok: false, error: MSG_NO_PERMISO })
    expect(procesarSincronizaciones).not.toHaveBeenCalled()
  })

  it('reintentarTareaEnFraccionamiento filtra por el fraccionamiento indicado', async () => {
    const t = tarea({ fraccionamiento_id: 9, estado: 'error' })
    const { admin } = bases([t])
    expect(await reintentarTareaEnFraccionamiento(8, t.id)).toEqual({ ok: false, error: MSG_ERROR })
    expect(admin.ops).toHaveLength(0)
    expect(await reintentarTareaEnFraccionamiento(9, t.id)).toEqual({ ok: true, data: undefined })
    expect(admin.tablas.sincronizaciones_acceso[0]).toMatchObject({ estado: 'pendiente', intentos: 0 })
    expect(procesarSincronizaciones).toHaveBeenCalledWith({ fraccionamientoId: 9 })
  })
})
