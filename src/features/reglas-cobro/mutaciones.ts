import { revalidatePath } from 'next/cache'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import { instalacionDe, recalcularPermisos } from '@/features/sincronizacion/cola'
import { dispararSincronizacion } from '@/features/sincronizacion/disparar'
import { MSG_RECARGO_NO_VALIDO, MSG_SIN_FRACCIONAMIENTO } from './messages'
import { reglasCobroSchema, type ReglasCobroInput } from './schemas'

/*
 * Escritura de reglas de cobro compartida por la acción del administrador (`./actions`) y la de la
 * consola. No es `'use server'`: no verifica rol. `fraccionamientoId` es `null` para el fraccionamiento
 * del usuario (RLS limita al suyo) y el id explícito para la consola. `recargo_desde` lo fija un trigger.
 */
export async function guardarReglasCobroEn(
  fraccionamientoId: number | null,
  input: ReglasCobroInput,
): Promise<ActionResult> {
  const parsed = reglasCobroSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)

  const ctx = await getTenantContext()
  const fid = fraccionamientoId ?? ctx?.fraccionamiento?.id
  if (fid == null) return fail(MSG_SIN_FRACCIONAMIENTO)

  const supabase = await createClient()
  const r = parsed.data
  const { error } = await supabase.from('reglas_cobro').upsert({
    fraccionamiento_id: fid,
    dia_generacion: r.diaGeneracion,
    dia_vencimiento: r.diaVencimiento,
    dias_gracia: r.diasGracia,
    cuotas_para_moroso: r.cuotasParaMoroso,
    concepto_recargo_id: r.conceptoRecargoId,
    updated_at: new Date().toISOString(),
    updated_by: ctx?.userId ?? null,
  })
  if (error) {
    // La FK compuesta exige que el concepto sea del mismo fraccionamiento.
    if (error.code === '23503') return fail(MSG_RECARGO_NO_VALIDO)
    throw new Error(error.message)
  }

  // Efecto inmediato en los permisos (el umbral o la gracia pudieron cambiar). Un fallo aquí no tumba
  // el guardado: las reglas ya están y el proceso diario recalcula.
  try {
    await recalcularPermisos(supabase, fid)
    if (await instalacionDe(supabase, fid)) dispararSincronizacion(fid)
  } catch (e) {
    console.error(`No se pudieron recalcular los permisos tras guardar las reglas: ${e instanceof Error ? e.message : e}`)
  }

  revalidatePath(fraccionamientoId === null ? '/configuracion' : `/admin/fraccionamientos/${fid}`)
  return ok(undefined)
}
