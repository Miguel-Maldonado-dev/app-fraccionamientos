import { autenticarResidente, jsonError, respuestaAuth } from '@/lib/app-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const auth = await autenticarResidente(request)
  if (!auth.ok) return respuestaAuth(auth)

  const [{ data: cuenta }, { data: filas, error }] = await Promise.all([
    auth.supabase.from('cuentas_residente').select('telefono').eq('user_id', auth.userId).maybeSingle(),
    auth.supabase.from('residentes').select('domicilio_id, es_principal, nombre').eq('user_id', auth.userId),
  ])
  if (error) return jsonError(500, 'No se pudo cargar la cuenta')

  const ids = [...new Set((filas ?? []).map((f) => f.domicilio_id))]
  let domicilios: {
    id: number
    direccion: string
    fraccionamiento: string
    es_principal: boolean
    nombre: string
  }[] = []
  if (ids.length > 0) {
    // Los ids provienen de las filas visibles por RLS del residente; el service-role solo completa nombres.
    const { data: doms, error: errDoms } = await createAdminClient()
      .from('domicilios')
      .select('id, direccion, fraccionamientos(nombre)')
      .in('id', ids)
      .order('id')
    if (errDoms) return jsonError(500, 'No se pudo cargar la cuenta')
    domicilios = (doms ?? []).map((d) => ({
      id: d.id,
      direccion: d.direccion,
      fraccionamiento: (d.fraccionamientos as { nombre: string } | null)?.nombre ?? '',
      es_principal: (filas ?? []).some((f) => f.domicilio_id === d.id && f.es_principal === true),
      // Nombre del residente en ese domicilio (puede variar por domicilio).
      nombre: (filas ?? []).find((f) => f.domicilio_id === d.id)?.nombre ?? '',
    }))
  }
  return Response.json({ telefono: cuenta?.telefono ?? null, domicilios })
}
