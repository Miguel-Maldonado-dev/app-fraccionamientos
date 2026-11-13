import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { AccesosVistas } from '@/features/registros-acceso/components/accesos-vistas'
import { RegistrosTab } from '@/features/registros-acceso/components/registros-tab'
import { vistaAccesos } from '@/features/registros-acceso/vistas'
import { PanelSincronizacion } from '@/features/sincronizacion/components/panel-sincronizacion'
import { procesarAhora, reintentarTarea } from '@/features/sincronizacion/actions'
import { instalacionDe } from '@/features/sincronizacion/cola'
import { listTareasAbiertas, resumenSincronizacion } from '@/features/sincronizacion/queries'
import { AuthorizationError, hasRole, requireRole } from '@/lib/auth/require-role'
import { ROLES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Record<string, string | string[] | undefined>

async function panelSincronizacion() {
  const supabase = await createClient()
  const [instalacion, resumen, tareas] = await Promise.all([
    instalacionDe(supabase, null),
    resumenSincronizacion(supabase, null),
    listTareasAbiertas(supabase, null),
  ])
  return (
    <PanelSincronizacion
      resumen={resumen}
      tareas={tareas}
      acciones={{ procesar: procesarAhora, reintentar: reintentarTarea }}
      tieneInstalacion={instalacion !== null}
    />
  )
}

export default async function AccesosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  let user
  try {
    user = await requireRole(ROLES.ADMINISTRADOR, ROLES.TESORERO)
  } catch (e) {
    if (e instanceof AuthorizationError) notFound()
    throw e
  }
  const esAdministrador = hasRole(user, [ROLES.ADMINISTRADOR])
  const sp = await searchParams
  const vista = esAdministrador ? vistaAccesos(sp.vista) : 'sincronizacion'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accesos"
        description={
          esAdministrador
            ? 'Registros de entradas y salidas de los paneles, y estado de la sincronización con access-core.'
            : 'Estado de la sincronización de domicilios, tarjetas, controles y PIN con access-core.'
        }
        breadcrumbs={[{ label: 'Accesos' }]}
      />
      {esAdministrador ? (
        <AccesosVistas vista={vista}>
          {vista === 'registros' ? (
            await RegistrosTab({
              fraccionamientoId: null,
              searchParams: sp,
              basePath: '/accesos',
              fijos: { vista: 'registros' },
            })
          ) : (
            await panelSincronizacion()
          )}
        </AccesosVistas>
      ) : (
        await panelSincronizacion()
      )}
    </div>
  )
}
