import { autenticarResidente, jsonError, respuestaAuth } from '@/lib/app-auth'
import { parseRouteId } from '@/lib/route-id'
import {
  agregarResidentePorPrincipal,
  listarResidentesDomicilio,
  MSG_DOMICILIO_NO_ENCONTRADO,
  type AgregarInput,
} from '@/features/residentes/residentes-principal'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Ctx) {
  const auth = await autenticarResidente(request)
  if (!auth.ok) return respuestaAuth(auth)
  const domicilioId = parseRouteId((await params).id)
  if (domicilioId === null) return jsonError(404, MSG_DOMICILIO_NO_ENCONTRADO)
  try {
    const r = await listarResidentesDomicilio(auth.supabase, auth.userId, domicilioId)
    if (!r.ok) return jsonError(r.status, r.error)
    return Response.json(r.data)
  } catch (e) {
    console.error('GET residentes app', e)
    return jsonError(500, 'Ocurrió un error, intenta de nuevo')
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const auth = await autenticarResidente(request)
  if (!auth.ok) return respuestaAuth(auth)
  const domicilioId = parseRouteId((await params).id)
  if (domicilioId === null) return jsonError(404, MSG_DOMICILIO_NO_ENCONTRADO)
  let body: AgregarInput
  try {
    const json: unknown = await request.json()
    if (!json || typeof json !== 'object') return jsonError(400, 'Solicitud inválida')
    body = json as AgregarInput
  } catch {
    return jsonError(400, 'Solicitud inválida')
  }
  try {
    const r = await agregarResidentePorPrincipal(auth.supabase, auth.userId, domicilioId, body)
    if (!r.ok) return jsonError(r.status, r.error)
    return Response.json(r.data, { status: 201 })
  } catch (e) {
    console.error('POST residentes app', e)
    return jsonError(500, 'Ocurrió un error, intenta de nuevo')
  }
}
