import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { listarInstalacionesDisponibles } from '@/features/fraccionamientos/access-core'
import { FraccionamientoDialog } from '@/features/fraccionamientos/components/fraccionamiento-dialog'
import { FraccionamientosTable } from '@/features/fraccionamientos/components/fraccionamientos-table'
import { listFraccionamientos } from '@/features/fraccionamientos/queries'
import { requireSuperAdminPage } from '@/lib/auth/require-super-admin-page'
import { createClient } from '@/lib/supabase/server'

export default async function FraccionamientosPage() {
  await requireSuperAdminPage()
  const supabase = await createClient()
  const [rows, instalaciones] = await Promise.all([
    listFraccionamientos(supabase),
    listarInstalacionesDisponibles(supabase),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraccionamientos"
        description="Crea y administra los fraccionamientos de la plataforma."
        breadcrumbs={[{ label: 'Fraccionamientos' }]}
        homeHref="/admin"
        actions={<FraccionamientoDialog instalaciones={instalaciones} trigger={<Button>+ Nuevo fraccionamiento</Button>} />}
      />
      <FraccionamientosTable rows={rows} instalaciones={instalaciones} />
    </div>
  )
}
