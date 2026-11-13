// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

type Op = { table: string; op: string; filters: Record<string, unknown>; payload?: unknown }
type Handler = (o: Op) => { data?: unknown; error?: unknown; count?: number }

/** Cliente falso encadenable: cada consulta se resuelve con `handler`. */
function fake(handler: Handler) {
  const ops: Op[] = []
  const client = {
    ops,
    rpc: vi.fn(async (name: string, args: unknown) => handler({ table: `rpc:${name}`, op: 'rpc', filters: args as Record<string, unknown> })),
    auth: { admin: { createUser: vi.fn(), updateUserById: vi.fn(async () => ({ error: null })), deleteUser: vi.fn() } },
    from(table: string) {
      const o: Op = { table, op: 'select', filters: {} }
      const chain: Record<string, unknown> = {}
      const self = () => chain
      for (const m of ['order', 'limit', 'neq', 'gte']) chain[m] = self
      chain.select = () => {
        if (o.op === 'select') o.op = 'select'
        return chain
      }
      chain.eq = (k: string, v: unknown) => ((o.filters[k] = v), chain)
      chain.insert = (p: unknown) => ((o.op = 'insert'), (o.payload = p), chain)
      chain.update = (p: unknown) => ((o.op = 'update'), (o.payload = p), chain)
      chain.delete = () => ((o.op = 'delete'), chain)
      const run = () => {
        ops.push(o)
        return { data: null, error: null, ...handler(o) }
      }
      chain.single = async () => run()
      chain.maybeSingle = async () => run()
      chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej)
      return chain
    },
  }
  return client
}

let admin: ReturnType<typeof fake>
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))

import {
  agregarResidentePorPrincipal,
  listarResidentesDomicilio,
  quitarResidentePorPrincipal,
} from './residentes-principal'

const yo = (es_principal: boolean) => (o: Op) =>
  o.table === 'residentes' && o.filters.user_id === 'u' ? { data: { id: 1, es_principal, fraccionamiento_id: 7 } } : null

function residenteCliente(es_principal: boolean | null, extra: Handler = () => ({})) {
  return fake((o) => {
    if (es_principal !== null) {
      const r = yo(es_principal)(o)
      if (r) return r
    }
    return extra(o)
  }) as never
}

const adminCon = (opts: { conCuenta?: number; cuentaExistente?: string | null; enDomicilio?: number } = {}) =>
  fake((o) => {
    if (o.table === 'fraccionamientos') return { data: { max_residentes_app: 3 } }
    if (o.table === 'rpc:residentes_con_cuenta') return { data: opts.conCuenta ?? 0 }
    if (o.table === 'cuentas_residente' && o.op === 'select')
      return { data: opts.cuentaExistente ? { user_id: opts.cuentaExistente, activo: true } : null }
    if (o.table === 'residentes' && o.op === 'select' && 'user_id' in o.filters && !('id' in o.filters))
      return { data: [], count: opts.enDomicilio ?? 0 }
    if (o.table === 'residentes' && o.op === 'insert') return { data: { id: 50 } }
    if (o.table === 'domicilio_concepto') return { data: null }
    return {}
  })

describe('residentes por el principal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista: domicilio ajeno ⇒ 404', async () => {
    const r = await listarResidentesDomicilio(residenteCliente(null), 'u', 9)
    expect(r).toMatchObject({ ok: false, status: 404 })
  })

  it('lista: cualquier residente ve con_acceso', async () => {
    const sb = residenteCliente(false, (o) =>
      o.table === 'residentes'
        ? { data: [{ id: 1, nombre: 'A', telefono: '1', es_principal: true, user_id: 'x' }, { id: 2, nombre: 'B', telefono: null, es_principal: false, user_id: null }] }
        : {},
    )
    const r = await listarResidentesDomicilio(sb, 'u', 9)
    expect(r).toEqual({
      ok: true,
      data: [
        { id: 1, nombre: 'A', telefono: '1', es_principal: true, con_acceso: true },
        { id: 2, nombre: 'B', telefono: null, es_principal: false, con_acceso: false },
      ],
    })
  })

  it('agregar: no principal ⇒ 403 sin service-role', async () => {
    admin = adminCon()
    const r = await agregarResidentePorPrincipal(residenteCliente(false), 'u', 9, { nombre: 'B', telefono: '5512345678', password: 'secreta123' })
    expect(r).toMatchObject({ ok: false, status: 403 })
    expect(admin.ops).toHaveLength(0)
  })

  it('agregar: domicilio ajeno ⇒ 404', async () => {
    admin = adminCon()
    const r = await agregarResidentePorPrincipal(residenteCliente(null), 'u', 9, { nombre: 'B', telefono: '5512345678' })
    expect(r).toMatchObject({ ok: false, status: 404 })
  })

  it('agregar: máximo ⇒ 422 sin createUser ni insert', async () => {
    admin = adminCon({ conCuenta: 3 })
    const r = await agregarResidentePorPrincipal(residenteCliente(true), 'u', 9, { nombre: 'B', telefono: '5512345678', password: 'secreta123' })
    expect(r).toMatchObject({ ok: false, status: 422 })
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
    expect(admin.ops.some((o) => o.op === 'insert')).toBe(false)
  })

  it('agregar: teléfono inválido ⇒ 422', async () => {
    admin = adminCon()
    const r = await agregarResidentePorPrincipal(residenteCliente(true), 'u', 9, { nombre: 'B', telefono: '12' })
    expect(r).toMatchObject({ ok: false, status: 422 })
  })

  it('agregar: teléfono sin cuenta y sin contraseña ⇒ 422 y revierte el alta', async () => {
    admin = adminCon()
    const r = await agregarResidentePorPrincipal(residenteCliente(true), 'u', 9, { nombre: 'B', telefono: '5512345678' })
    expect(r).toMatchObject({ ok: false, status: 422 })
    expect(admin.ops.some((o) => o.table === 'residentes' && o.op === 'delete' && o.filters.id === 50)).toBe(true)
  })

  it('agregar: teléfono ya con acceso en el domicilio ⇒ 422 sin insertar', async () => {
    admin = adminCon({ cuentaExistente: 'otro', enDomicilio: 1 })
    const r = await agregarResidentePorPrincipal(residenteCliente(true), 'u', 9, { nombre: 'B', telefono: '5512345678' })
    expect(r).toMatchObject({ ok: false, status: 422 })
    expect(admin.ops.some((o) => o.op === 'insert')).toBe(false)
  })

  it('agregar: teléfono existente ⇒ vincula sin contraseña', async () => {
    admin = adminCon({ cuentaExistente: 'otro' })
    const r = await agregarResidentePorPrincipal(residenteCliente(true), 'u', 9, { nombre: 'B', telefono: '55 1234 5678' })
    expect(r).toEqual({ ok: true, data: { id: 50, cuentaCreada: false } })
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
    const ins = admin.ops.find((o) => o.op === 'insert' && o.table === 'residentes')
    expect(ins?.payload).toMatchObject({ domicilio_id: 9, fraccionamiento_id: 7, nombre: 'B' })
    expect(admin.ops.find((o) => o.op === 'update' && o.table === 'residentes')?.payload).toMatchObject({ user_id: 'otro' })
  })

  it('quitar: no principal ⇒ 403', async () => {
    admin = adminCon()
    const r = await quitarResidentePorPrincipal(residenteCliente(false), 'u', 9, 2)
    expect(r).toMatchObject({ ok: false, status: 403 })
    expect(admin.ops).toHaveLength(0)
  })

  it('quitar: a sí mismo ⇒ 422', async () => {
    admin = adminCon()
    const r = await quitarResidentePorPrincipal(residenteCliente(true), 'u', 9, 1)
    expect(r).toEqual({ ok: false, status: 422, error: 'No puedes quitarte a ti mismo' })
  })

  it('quitar: residente de otro domicilio ⇒ 404', async () => {
    admin = adminCon()
    const r = await quitarResidentePorPrincipal(residenteCliente(true), 'u', 9, 2)
    expect(r).toMatchObject({ ok: false, status: 404 })
    expect(admin.ops).toHaveLength(0)
  })

  it('quitar: con acceso ⇒ limpia teléfonos, borra y desactiva cuenta sin domicilios', async () => {
    admin = fake((o) => (o.table === 'residentes' && o.op === 'select' ? { count: 0 } : {}))
    const sb = residenteCliente(true, (o) =>
      o.table === 'residentes' && o.filters.id === 2 ? { data: { id: 2, user_id: 'x' } } : {},
    )
    const r = await quitarResidentePorPrincipal(sb, 'u', 9, 2)
    expect(r).toEqual({ ok: true, data: null })
    const t = admin.ops.map((o) => `${o.table}:${o.op}`)
    expect(t).toEqual(['telefonos_acceso:delete', 'residentes:delete', 'residentes:select', 'cuentas_residente:update'])
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('x', expect.anything())
  })
})
