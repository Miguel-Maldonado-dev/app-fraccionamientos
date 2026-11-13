import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { parseRouteId } from '@/lib/route-id'
import { createClient } from '@/lib/supabase/server'
import { getPagoRecibo } from '@/features/pagos/queries'
import { parseRecibo } from '@/features/pagos/recibo/datos'
import { respuestaReciboPdf } from '@/features/pagos/recibo/respuesta'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pagoId: string }> },
) {
  const user = await getCurrentUser()
  if (!user || !user.isActive) return new Response('No autorizado', { status: 401 })

  const pagoId = parseRouteId((await params).pagoId)
  if (pagoId === null) return new Response('Recibo no disponible', { status: 404 })

  const supabase = await createClient()
  const pago = await getPagoRecibo(supabase, pagoId)
  const datos = pago ? parseRecibo(pago.recibo) : null
  if (!pago || !datos) return new Response('Recibo no disponible', { status: 404 })

  return respuestaReciboPdf(pago.referencia, datos)
}
