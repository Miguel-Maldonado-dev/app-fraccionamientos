import { procesarSincronizaciones } from '@/features/sincronizacion/worker'

/** Lo llama el cron del hosting con `Authorization: Bearer <CRON_SECRET>`; procesa todos los fraccionamientos. */
export async function POST(request: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return new Response('No autorizado', { status: 401 })
  }
  return Response.json(await procesarSincronizaciones({}))
}

/** Vercel Cron invoca con GET; se acepta con la misma autorización. */
export const GET = POST
