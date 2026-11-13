import { autenticarResidente, jsonError, respuestaAuth } from '@/lib/app-auth'
import { parseRouteId } from '@/lib/route-id'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autenticarResidente(request)
  if (!auth.ok) return respuestaAuth(auth)
  const id = parseRouteId((await params).id)
  if (id === null) return jsonError(404, 'Domicilio no encontrado')

  const { data, error } = await auth.supabase.rpc('estado_app_domicilio', { p_domicilio_id: id })
  if (error) {
    if (error.code === '42501') return jsonError(404, 'Domicilio no encontrado')
    return jsonError(500, 'No se pudo cargar el estado')
  }
  return Response.json(data)
}
