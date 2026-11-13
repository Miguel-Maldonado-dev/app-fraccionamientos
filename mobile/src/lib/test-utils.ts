export function respuesta(status: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
export function sesion(token: string) {
  return { data: { session: { access_token: token } }, error: null }
}

/** Consulta encadenable de supabase-js (`select/eq/order` ⇒ `{ data, error }`). */
export function consulta(data: unknown, error: unknown = null) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'in', 'limit']) q[m] = jest.fn(() => q)
  q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data, error }).then(ok, ko)
  return q
}
/** Responde `supabase.from(tabla)` con los datos por tabla. */
export function tablas(datos: Record<string, unknown>) {
  return (t: string) => consulta(datos[t] ?? [])
}
