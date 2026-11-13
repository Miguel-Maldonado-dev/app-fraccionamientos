import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser, getTenantContext, toCurrentUser, type TenantContext } from '@/lib/auth/tenant-context'
import { AccessCoreError, listarLogs, listarPaneles } from '@/lib/access-core'
import { createClient } from '@/lib/supabase/server'
import { fakeQuery, fakeSupabase } from '@/test/fake-query'
import { consultarRegistros, opcionesRegistros, paginaExport } from './actions'
import type { Filtros } from './filtros'
import type { Log } from '@/lib/access-core/tipos'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/access-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/access-core')>()),
  listarLogs: vi.fn(),
  listarPaneles: vi.fn(),
}))
vi.mock('@/lib/auth/tenant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/tenant-context')>()),
  getTenantContext: vi.fn(),
  getCurrentUser: vi.fn(),
}))

const SUPER: TenantContext = {
  userId: 'u0',
  email: 'root@plataforma.mx',
  perfil: { nombre: 'Root', email: 'root@plataforma.mx', rol: 'super_admin', activo: true, fraccionamientoId: null },
  fraccionamiento: null,
}
const ADMIN: TenantContext = {
  ...SUPER,
  perfil: { ...SUPER.perfil!, rol: 'administrador', fraccionamientoId: 4 },
  fraccionamiento: { id: 4, nombre: 'A' },
}
const TESORERO: TenantContext = { ...ADMIN, perfil: { ...ADMIN.perfil!, rol: 'tesorero' } }
const F: Filtros = { desde: '2026-11-13', hasta: '2026-11-13', pagina: 1 }
const DOMS = [
  { id: 1, direccion: 'Calle 1', titular_id: 'h1' },
  { id: 2, direccion: 'Calle 2', titular_id: 'h2' },
]
const LOG: Log = {
  id: 9, ts: '2026-11-13T10:00:00', panel_id: 'p', panel_code: 'P1', allowed: true, source: 0, reason: 0,
  holder_id: 'h2', holder_name: 'Ana', holder_kind: null, credential_label: null, control_id: null,
  code: null, device_id: null, output_index: null, output_alias: null,
}

let fracc: ReturnType<typeof fakeQuery>
let doms: ReturnType<typeof fakeQuery>
function usar(ctx: TenantContext, instalacion: string | null = 'inst-1') {
  vi.mocked(getTenantContext).mockResolvedValue(ctx)
  vi.mocked(getCurrentUser).mockResolvedValue(toCurrentUser(ctx))
  fracc = fakeQuery({ data: { instalacion_id: instalacion } })
  doms = fakeQuery({ data: DOMS })
  vi.mocked(createClient).mockResolvedValue(fakeSupabase({ fraccionamientos: fracc, domicilios: doms }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listarLogs).mockResolvedValue({ data: [LOG], page: 1, page_size: 50, total: 101 })
})

describe('consultarRegistros', () => {
  it('administrador: su fraccionamiento, traduce y pagina', async () => {
    usar(ADMIN)
    const r = await consultarRegistros(null, F)
    expect(r).toMatchObject({ ok: true, total: 101, pagina: 1, paginas: 3 })
    if (r.ok) expect(r.filas[0].titular).toBe('Calle 2')
    expect(fracc.calls).toContainEqual({ method: 'eq', args: ['id', 4] })
    expect(doms.calls).toContainEqual({ method: 'eq', args: ['fraccionamiento_id', 4] })
    expect(listarLogs).toHaveBeenCalledWith('inst-1', expect.objectContaining({ titular: undefined, pagina: 1 }))
  })
  it('administrador con id ajeno ⇒ No autorizado sin llamar access-core', async () => {
    usar(ADMIN)
    expect(await consultarRegistros(99, F)).toEqual({ ok: false, error: 'No autorizado' })
    expect(listarLogs).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })
  it('tesorero ⇒ No autorizado', async () => {
    usar(TESORERO)
    expect(await consultarRegistros(null, F)).toEqual({ ok: false, error: 'No autorizado' })
    expect(listarLogs).not.toHaveBeenCalled()
  })
  it('super admin con id', async () => {
    usar(SUPER)
    expect((await consultarRegistros(7, F)).ok).toBe(true)
    expect(fracc.calls).toContainEqual({ method: 'eq', args: ['id', 7] })
  })
  it('super admin sin id ⇒ No autorizado', async () => {
    usar(SUPER)
    expect(await consultarRegistros(null, F)).toEqual({ ok: false, error: 'No autorizado' })
  })
  it('domicilio ⇒ titular = su titular_id', async () => {
    usar(ADMIN)
    await consultarRegistros(null, { ...F, domicilio: 2, origen: '3', pagina: 2 })
    expect(listarLogs).toHaveBeenCalledWith('inst-1', expect.objectContaining({ titular: 'h2', origen: '3', pagina: 2 }))
  })
  it('domicilio fuera del fraccionamiento ⇒ vacío sin consultar', async () => {
    usar(ADMIN)
    expect(await consultarRegistros(null, { ...F, domicilio: 55 })).toMatchObject({ ok: true, total: 0, filas: [] })
    expect(listarLogs).not.toHaveBeenCalled()
  })
  it('429 ⇒ mensaje de demasiadas consultas', async () => {
    usar(ADMIN)
    vi.mocked(listarLogs).mockRejectedValue(new AccessCoreError(429, 'rate', 'x'))
    expect(await consultarRegistros(null, F)).toEqual({ ok: false, error: 'Demasiadas consultas, espera un momento' })
  })
  it('otro error ⇒ mensaje genérico', async () => {
    usar(ADMIN)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(listarLogs).mockRejectedValue(new AccessCoreError(500, 'x', 'x'))
    expect(await consultarRegistros(null, F)).toEqual({ ok: false, error: 'No se pudieron cargar los registros' })
  })
  it('sin instalación ⇒ sinInstalacion', async () => {
    usar(ADMIN, null)
    expect(await consultarRegistros(null, F)).toEqual({
      ok: false, sinInstalacion: true, error: 'Este fraccionamiento no tiene instalación de access-core.',
    })
  })
})

describe('opcionesRegistros', () => {
  it('domicilios con titular y paneles', async () => {
    usar(ADMIN)
    vi.mocked(listarPaneles).mockResolvedValue([{ id: 'p1', panel_code: 'P1', online: true } as never])
    expect(await opcionesRegistros(null)).toEqual({
      domicilios: [{ id: 1, direccion: 'Calle 1' }, { id: 2, direccion: 'Calle 2' }],
      paneles: [{ id: 'p1', panel_code: 'P1' }],
    })
    expect(doms.calls).toContainEqual({ method: 'not', args: ['titular_id', 'is', null] })
  })
  it('no autorizado ⇒ vacío', async () => {
    usar(TESORERO)
    expect(await opcionesRegistros(null)).toEqual({ domicilios: [], paneles: [] })
  })
})

describe('validación de filtros en servidor', () => {
  const casos: [string, Filtros][] = [
    ['fecha mal formada', { ...F, desde: '2026-13-01' }],
    ['hasta mal formada', { ...F, hasta: 'x' }],
    ['rango invertido', { ...F, desde: '2026-11-14' }],
    ['más de 31 días', { ...F, desde: '2026-10-01' }],
    ['origen fuera de catálogo', { ...F, origen: '9' as never }],
    ['resultado fuera de catálogo', { ...F, resultado: 'x' as never }],
    ['panel inválido', { ...F, panel: 'a b;' }],
  ]
  it.each(casos)('%s ⇒ error sin llamar access-core', async (_n, f) => {
    usar(ADMIN)
    const r = await consultarRegistros(null, f)
    expect(r.ok).toBe(false)
    expect((await paginaExport(null, f, 1)).ok).toBe(false)
    expect(listarLogs).not.toHaveBeenCalled()
  })
  it('rango de 31 días exactos es válido', async () => {
    usar(ADMIN)
    expect((await consultarRegistros(null, { ...F, desde: '2026-10-14' })).ok).toBe(true)
  })
})

describe('paginaExport', () => {
  it('página 1 trae meta; otras no', async () => {
    usar(ADMIN)
    const r = await paginaExport(null, F, 1)
    expect(r).toMatchObject({ ok: true, meta: { generadoPor: 'Root', generadoEn: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/) } })
    const r2 = await paginaExport(null, F, 2)
    expect(r2.ok && r2.meta).toBeFalsy()
    expect(listarLogs).toHaveBeenLastCalledWith('inst-1', expect.objectContaining({ pagina: 2 }))
  })
  it('administrador con id ajeno ⇒ No autorizado', async () => {
    usar(ADMIN)
    expect(await paginaExport(99, F, 1)).toEqual({ ok: false, error: 'No autorizado' })
  })
  it('429 ⇒ espera Retry-After (máx. 10 s) y reintenta una vez', async () => {
    usar(ADMIN)
    vi.useFakeTimers()
    try {
      vi.mocked(listarLogs).mockRejectedValueOnce(new AccessCoreError(429, 'rate', 'x', 60))
      const p = paginaExport(null, F, 2)
      await vi.advanceTimersByTimeAsync(9_999)
      expect(listarLogs).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect((await p).ok).toBe(true)
      expect(listarLogs).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
  it('429 dos veces ⇒ demasiadas consultas', async () => {
    usar(ADMIN)
    vi.mocked(listarLogs).mockRejectedValue(new AccessCoreError(429, 'rate', 'x', 0))
    expect(await paginaExport(null, F, 2)).toEqual({ ok: false, error: 'Demasiadas consultas, espera un momento' })
    expect(listarLogs).toHaveBeenCalledTimes(2)
  })
})

describe('opcionesRegistros con error de Supabase', () => {
  it('devuelve opciones vacías en lugar de lanzar', async () => {
    usar(ADMIN)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase({ fraccionamientos: fracc, domicilios: fakeQuery({ data: null, error: { message: 'boom' } }) }) as never,
    )
    expect(await opcionesRegistros(null)).toEqual({ domicilios: [], paneles: [] })
  })
})
