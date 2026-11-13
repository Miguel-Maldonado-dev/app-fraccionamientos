import { autenticarResidente, jsonError, respuestaAuth, requestedBy } from '@/lib/app-auth'
import { AccessCoreError } from '@/lib/access-core/errores'
import { abrirSalida, describirApertura } from '@/lib/access-core/salidas'
import { parseRouteId } from '@/lib/route-id'
import { createAdminClient } from '@/lib/supabase/admin'

const LIMITE = 10
const VENTANA_SEGUNDOS = 60

const MSG_MOROSO = 'Tu domicilio tiene adeudos'
const MSG_NO_DISPONIBLE = 'Este acceso no está disponible'
const MSG_LIMITE = 'Demasiados intentos, espera un momento'
const MSG_ERROR = 'No se pudo abrir, intenta de nuevo'
const MSG_NO_ENCONTRADO = 'Domicilio no encontrado'

type Resultado = 'opened' | 'denied' | 'failed' | 'timeout' | 'moroso' | 'no_disponible' | 'limite' | 'error'
type BotonEstado = { id: number; habilitado: boolean }
type Estado = { moroso: boolean; botones: BotonEstado[] }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autenticarResidente(request)
  if (!auth.ok) return respuestaAuth(auth)
  const domicilioId = parseRouteId((await params).id)
  if (domicilioId === null) return jsonError(404, MSG_NO_ENCONTRADO)

  let botonId: unknown
  try {
    botonId = ((await request.json()) as { botonId?: unknown })?.botonId
  } catch {
    botonId = undefined
  }
  if (typeof botonId !== 'number' || !Number.isSafeInteger(botonId) || botonId < 1) {
    return jsonError(400, 'Solicitud inválida')
  }

  // Pertenencia, moroso y botones: con el token del residente (42501 si no le pertenece).
  const { data: estadoJson, error: errEstado } = await auth.supabase.rpc('estado_app_domicilio', {
    p_domicilio_id: domicilioId,
  })
  if (errEstado) {
    if (errEstado.code === '42501') return jsonError(404, MSG_NO_ENCONTRADO)
    return jsonError(500, MSG_ERROR)
  }
  const estado = estadoJson as unknown as Estado
  const boton = estado.botones?.find((b) => b.id === botonId)
  if (!boton) return jsonError(404, 'Botón no encontrado')

  // A partir de aquí el residente está validado: se permite el service-role.
  const admin = createAdminClient()
  const { data: dom, error: errDom } = await admin
    .from('domicilios')
    .select('fraccionamiento_id, titular_id, fraccionamientos(instalacion_id)')
    .eq('id', domicilioId)
    .single()
  if (errDom || !dom) return jsonError(500, MSG_ERROR)

  // La auditoría nunca cambia la respuesta: cualquier fallo al registrar solo se anota en el log.
  const auditar = async (resultado: Resultado, detalle: string | null = null) => {
    try {
      const { error } = await admin.from('aperturas_remotas').insert({
        fraccionamiento_id: dom.fraccionamiento_id,
        domicilio_id: domicilioId,
        boton_id: botonId as number,
        user_id: auth.userId,
        resultado,
        detalle: detalle === null ? null : String(detalle).slice(0, 500),
      })
      if (error) console.error('No se pudo registrar la apertura remota', error)
    } catch (e) {
      console.error('No se pudo registrar la apertura remota', e)
    }
  }

  if (estado.moroso) {
    await auditar('moroso')
    return jsonError(409, MSG_MOROSO)
  }

  const desde = new Date(Date.now() - VENTANA_SEGUNDOS * 1000).toISOString()
  const { count, error: errCount } = await admin
    .from('aperturas_remotas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .gte('created_at', desde)
  if (errCount) return jsonError(500, MSG_ERROR)
  if ((count ?? 0) >= LIMITE) {
    await auditar('limite')
    return jsonError(429, MSG_LIMITE)
  }

  const { data: fila } = await admin
    .from('app_botones')
    .select('salida_id')
    .eq('id', botonId)
    .eq('fraccionamiento_id', dom.fraccionamiento_id)
    .maybeSingle()
  const instalacionId = (dom.fraccionamientos as { instalacion_id: string | null } | null)?.instalacion_id ?? null
  const salidaId = fila?.salida_id ?? null
  if (!instalacionId || !dom.titular_id || !salidaId) {
    await auditar('no_disponible')
    return jsonError(422, MSG_NO_DISPONIBLE)
  }

  const { data: residente } = await auth.supabase
    .from('residentes')
    .select('nombre')
    .eq('user_id', auth.userId)
    .eq('domicilio_id', domicilioId)
    .limit(1)
    .maybeSingle()

  let res: Awaited<ReturnType<typeof abrirSalida>>
  try {
    res = await abrirSalida(instalacionId, salidaId, {
      holderId: dom.titular_id,
      requestedBy: requestedBy(residente?.nombre),
    })
  } catch (e) {
    if (e instanceof AccessCoreError && e.status === 404) {
      await auditar('no_disponible', e.message)
      return jsonError(422, MSG_NO_DISPONIBLE)
    }
    if (e instanceof AccessCoreError && e.status === 429) {
      await auditar('limite', e.message)
      return jsonError(429, MSG_LIMITE)
    }
    await auditar('error', e instanceof Error ? e.message : String(e))
    return jsonError(502, MSG_ERROR)
  }
  // Fuera del try: lo que pase después de que access-core respondió no debe convertirse en 502.
  await auditar(res.status, describirApertura(res))
  return Response.json({ status: res.status })
}
