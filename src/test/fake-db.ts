import { vi, type Mock } from 'vitest'

type Fila = Record<string, unknown>
type Filtro = (fila: Fila) => boolean
export type Operacion = { tabla: string; tipo: 'update' | 'insert' | 'delete'; valores?: unknown; filas: Fila[] }

/**
 * Base de datos en memoria con un subconjunto del query builder de supabase-js: `select`, `insert`,
 * `update`, `delete`, `eq`, `neq`, `in`, `is`, `lte`, `order`, `limit`, `maybeSingle` y `single`.
 * `select` ignora las columnas y devuelve filas completas. Registra cada escritura en `ops`.
 */
export function fakeDb(tablas: Record<string, Fila[]>, rpc: Mock = vi.fn(async () => ({ data: null, error: null }))) {
  const ops: Operacion[] = []

  function from(tabla: string) {
    tablas[tabla] ??= []
    const filtros: Filtro[] = []
    let tipo: 'select' | 'update' | 'insert' | 'delete' = 'select'
    let valores: unknown
    let orden: { col: string; asc: boolean } | null = null
    let limite: number | null = null
    let unico: 'maybe' | 'single' | null = null

    function ejecutar() {
      const filas = tablas[tabla]
      if (tipo === 'insert') {
        const nuevas = (Array.isArray(valores) ? valores : [valores]) as Fila[]
        filas.push(...nuevas.map((f) => ({ ...f })))
        ops.push({ tabla, tipo, valores, filas: nuevas })
        return { data: nuevas, error: null }
      }
      let afectadas = filas.filter((f) => filtros.every((p) => p(f)))
      if (tipo === 'update') {
        for (const f of afectadas) Object.assign(f, valores as Fila)
        ops.push({ tabla, tipo, valores, filas: afectadas.map((f) => ({ ...f })) })
      } else if (tipo === 'delete') {
        tablas[tabla] = filas.filter((f) => !afectadas.includes(f))
        ops.push({ tabla, tipo, filas: afectadas })
      }
      if (orden) {
        const { col, asc } = orden
        afectadas = [...afectadas].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1))
      }
      if (limite != null) afectadas = afectadas.slice(0, limite)
      const copia = afectadas.map((f) => ({ ...f }))
      if (unico === 'maybe') return { data: copia[0] ?? null, error: null }
      if (unico === 'single') {
        return copia.length === 1 ? { data: copia[0], error: null } : { data: null, error: { message: 'no single row' } }
      }
      return { data: copia, error: null }
    }

    const builder = {
      select: () => builder,
      insert: (v: unknown) => ((tipo = 'insert'), (valores = v), builder),
      update: (v: unknown) => ((tipo = 'update'), (valores = v), builder),
      delete: () => ((tipo = 'delete'), builder),
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), builder),
      neq: (c: string, v: unknown) => (filtros.push((f) => f[c] !== v), builder),
      in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[c])), builder),
      is: (c: string, v: unknown) => (filtros.push((f) => (f[c] ?? null) === v), builder),
      lte: (c: string, v: unknown) => (filtros.push((f) => String(f[c]) <= String(v)), builder),
      order: (col: string, o: { ascending?: boolean } = {}) => ((orden = { col, asc: o.ascending !== false }), builder),
      limit: (n: number) => ((limite = n), builder),
      maybeSingle: () => ((unico = 'maybe'), builder),
      single: () => ((unico = 'single'), builder),
      then: (ok?: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(ejecutar()).then(ok, ko),
    }
    return builder
  }

  return { client: { from: vi.fn(from), rpc }, tablas, ops }
}
