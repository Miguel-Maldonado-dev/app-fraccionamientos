import { PageHeader } from '@/components/page-header'
import { ResidentesView } from '@/features/residentes/components/residentes-view'
import { listDispositivos, listResidentesConDomicilio } from '@/features/residentes/queries'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { hasRole } from '@/lib/auth/require-role'
import { ROLES, ROLES_GESTION } from '@/lib/constants'
import { listDomiciliosOptions } from '@/features/domicilios/queries'
import { parseRouteId } from '@/lib/route-id'
import { createClient } from '@/lib/supabase/server'

export default async function ResidentesPage({
  searchParams,
}: {
  searchParams: Promise<{ domicilio?: string | string[] }>
}) {
  const sp = await searchParams
  const raw = Array.isArray(sp.domicilio) ? sp.domicilio[0] : sp.domicilio
  const domicilioId = parseRouteId(raw ?? '') ?? undefined

  const supabase = await createClient()
  const [options, rows, user] = await Promise.all([
    listDomiciliosOptions(supabase),
    listResidentesConDomicilio(supabase, domicilioId),
    getCurrentUser(),
  ])
  // Mismas reglas que el detalle del domicilio: cuenta de la app para administrador y tesorero;
  // desligar dispositivo solo administrador.
  const puedeGestionar = hasRole(user, ROLES_GESTION)
  const dispositivos = puedeGestionar
    ? await listDispositivos(
        supabase,
        rows.flatMap((r) => (r.user_id ? [r.user_id] : [])),
      )
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Residentes"
        description="Consulta los residentes del fraccionamiento."
        breadcrumbs={[{ label: 'Residentes' }]}
      />
      <ResidentesView
        rows={rows}
        domicilios={options}
        domicilioId={domicilioId}
        accesoApp={puedeGestionar}
        dispositivos={dispositivos}
        puedeDesligar={hasRole(user, [ROLES.ADMINISTRADOR])}
      />
    </div>
  )
}
