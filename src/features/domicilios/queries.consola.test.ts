import { describe, expect, it } from 'vitest'
import { getDomicilioConsola, listDomiciliosConsola, listTiposCuotaConsola } from './queries'

type Call = { table: string; select?: string; eq: [string, unknown][] }

/** Cliente falso: registra tabla, select y filtros y responde con `data[tabla]`. */
function fake(data: Record<string, unknown>) {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      const call: Call = { table, eq: [] }
      calls.push(call)
      const q: Record<string, unknown> = {
        select(s: string) {
          call.select = s
          return q
        },
        eq(c: string, v: unknown) {
          call.eq.push([c, v])
          return q
        },
        order: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: data[table] ?? null, error: null }),
        then: (res: (v: unknown) => unknown) => res({ data: data[table] ?? [], error: null }),
      }
      return q
    },
  }
  return { client: client as never, calls }
}

describe('consultas de la consola', () => {
  it('listDomiciliosConsola filtra por fraccionamiento, no selecciona estatus y une el residente principal', async () => {
    const { client, calls } = fake({
      domicilios: [
        {
          id: 1,
          direccion: 'A 1',
          fecha_alta: '2026-01-01',
          observaciones: null,
        },
      ],
      residentes: [{ domicilio_id: 1, nombre: 'Ana' }],
      domicilio_concepto: [{ domicilio_id: 1, concepto_id: 4 }],
      conceptos_pago: [{ id: 4, nombre: 'Completa' }],
    })
    const rows = await listDomiciliosConsola(client, 5)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 1,
      direccion: 'A 1',
      residente_principal: 'Ana',
      estatus: null,
    })
    for (const c of calls) expect(c.eq).toContainEqual(['fraccionamiento_id', 5])
    expect(calls.map((c) => c.select).join(' ')).not.toContain('estatus')
    expect(calls.map((c) => c.table)).not.toContain('domicilios_info')
  })

  it('getDomicilioConsola devuelve el fraccionamiento del domicilio y nunca estatus', async () => {
    const { client, calls } = fake({
      domicilios: {
        id: 3,
        direccion: 'B 2',
        fecha_alta: '2026-01-01',
        observaciones: null,
        fraccionamiento_id: 9,
      },
      domicilio_concepto: { concepto_id: 4 },
      conceptos_pago: { nombre: 'Completa' },
      concepto_pago_acceso: { medios: ['telefono'] },
    })
    const d = await getDomicilioConsola(client, 3)
    expect(d).toMatchObject({
      id: 3,
      fraccionamientoId: 9,
      tipo_cuota: 'Completa',
      id_concepto: 4,
      medios: ['telefono'],
      estatus: null,
    })
    expect(calls.map((c) => c.table)).not.toContain('domicilios_info')
  })

  it('getDomicilioConsola devuelve null si no existe', async () => {
    const { client } = fake({})
    expect(await getDomicilioConsola(client, 3)).toBeNull()
  })

  it('listTiposCuotaConsola solo selecciona id y nombre del fraccionamiento (sin importe)', async () => {
    const { client, calls } = fake({ conceptos_pago: [{ id: 4, nombre: 'Completa' }] })
    expect(await listTiposCuotaConsola(client, 5)).toEqual([{ id: 4, nombre: 'Completa' }])
    expect(calls[0].select).toBe('id, nombre')
    expect(calls[0].eq).toContainEqual(['fraccionamiento_id', 5])
  })
})
