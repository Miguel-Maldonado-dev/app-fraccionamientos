import { PageHeader } from '@/components/page-header'
import { MetricasPlataforma } from '@/features/fraccionamientos/components/metricas-plataforma'
import { listMetricasFraccionamientos } from '@/features/fraccionamientos/metricas'
import { requireSuperAdminPage } from '@/lib/auth/require-super-admin-page'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  await requireSuperAdminPage()
  const supabase = await createClient()
  const rows = await listMetricasFraccionamientos(supabase)

  return (
    <div className="space-y-6">
      <PageHeader title="Inicio" description="Resumen de la plataforma." breadcrumbs={[]} homeHref="/admin" />
      <MetricasPlataforma rows={rows} />
    </div>
  )
}
