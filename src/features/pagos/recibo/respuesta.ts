import 'server-only'
import type { ReciboDatos } from '@/features/pagos/recibo/datos'
import { cargarLogo } from '@/features/pagos/recibo/logo'
import { generarReciboPdf } from '@/features/pagos/recibo/pdf'

/** PDF del recibo generado al vuelo a partir de la foto JSON guardada al registrar el pago. */
export async function respuestaReciboPdf(referencia: string, datos: ReciboDatos): Promise<Response> {
  const bytes = await generarReciboPdf(datos, referencia, await cargarLogo())
  const filename = referencia.replace(/["\\\r\n]/g, '').replace(/[^\x20-\x7E]/g, '')
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
