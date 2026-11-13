import { autenticarResidente, jsonError, respuestaAuth } from '@/lib/app-auth'
import { parseRouteId } from '@/lib/route-id'
import {
  MSG_DOMICILIO_NO_ENCONTRADO,
  MSG_RESIDENTE_NO_ENCONTRADO_APP,
  quitarResidentePorPrincipal,
} from '@/features/residentes/residentes-principal'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; residenteId: string }> },
) {
  const auth = await autenticarResidente(request)
  if (!auth.ok) return respuestaAuth(auth)
  const p = await params
  const domicilioId = parseRouteId(p.id)
  if (domicilioId === null) return jsonError(404, MSG_DOMICILIO_NO_ENCONTRADO)
  const residenteId = parseRouteId(p.residenteId)
  if (residenteId === null) return jsonError(404, MSG_RESIDENTE_NO_ENCONTRADO_APP)
  try {
    const r = await quitarResidentePorPrincipal(auth.supabase, auth.userId, domicilioId, residenteId)
    if (!r.ok) return jsonError(r.status, r.error)
    return new Response(null, { status: 204 })
  } catch (e) {
    console.error('DELETE residente app', e)
    return jsonError(500, 'Ocurrió un error, intenta de nuevo')
  }
}
