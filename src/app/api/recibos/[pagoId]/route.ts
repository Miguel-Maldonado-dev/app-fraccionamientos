import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { parseRouteId } from '@/lib/route-id'
import { createClient } from '@/lib/supabase/server'
import { getPagoRecibo } from '@/features/pagos/queries'
import { parseRecibo } from '@/features/pagos/recibo/datos'
import { cargarLogo } from '@/features/pagos/recibo/logo'
import { generarReciboPdf } from '@/features/pagos/recibo/pdf'

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

  // El PDF se genera al vuelo a partir de la foto JSON guardada al registrar el pago.
  const bytes = await generarReciboPdf(datos, pago.referencia, await cargarLogo())
  const filename = pago.referencia.replace(/["\\\r\n]/g, '').replace(/[^\x20-\x7E]/g, '')
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
