import { autenticarResidente, jsonError, respuestaAuth } from '@/lib/app-auth'
import { parseRouteId } from '@/lib/route-id'
import { getPagoRecibo } from '@/features/pagos/queries'
import { parseRecibo } from '@/features/pagos/recibo/datos'
import { respuestaReciboPdf } from '@/features/pagos/recibo/respuesta'

/** PDF del recibo de un pago de los domicilios del residente (RLS); ajeno o sin recibo ⇒ 404. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autenticarResidente(request)
  if (!auth.ok) return respuestaAuth(auth)
  const id = parseRouteId((await params).id)
  if (id === null) return jsonError(404, 'Recibo no disponible')

  let pago: Awaited<ReturnType<typeof getPagoRecibo>>
  try {
    pago = await getPagoRecibo(auth.supabase, id)
  } catch {
    return jsonError(500, 'No se pudo cargar el recibo')
  }
  const datos = pago ? parseRecibo(pago.recibo) : null
  if (!pago || !datos) return jsonError(404, 'Recibo no disponible')
  return respuestaReciboPdf(pago.referencia, datos)
}
