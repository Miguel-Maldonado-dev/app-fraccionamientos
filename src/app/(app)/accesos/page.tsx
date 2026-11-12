import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { PanelSincronizacion } from '@/features/sincronizacion/components/panel-sincronizacion'
import { procesarAhora, reintentarTarea } from '@/features/sincronizacion/actions'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { listTareasAbiertas, resumenSincronizacion } from '@/features/sincronizacion/queries'
import { AuthorizationError, requireRole } from '@/lib/auth/require-role'
import { ROLES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

export default async function AccesosPage() {
  try {
    await requireRole(ROLES.ADMINISTRADOR, ROLES.TESORERO)
  } catch (e) {
    if (e instanceof AuthorizationError) notFound()
    throw e
  }

  const supabase = await createClient()
  const [instalacion, resumen, tareas] = await Promise.all([
    instalacionDe(supabase, null),
    resumenSincronizacion(supabase, null),
    listTareasAbiertas(supabase, null),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accesos"
        description="Estado de la sincronización de domicilios, tarjetas, controles y PIN con access-core."
        breadcrumbs={[{ label: 'Accesos' }]}
      />
      <PanelSincronizacion
        resumen={resumen}
        tareas={tareas}
        acciones={{ procesar: procesarAhora, reintentar: reintentarTarea }}
        tieneInstalacion={instalacion !== null}
      />
    </div>
  )
}
