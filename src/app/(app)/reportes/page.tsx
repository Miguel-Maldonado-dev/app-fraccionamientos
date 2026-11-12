import { PagosUsuarioTab } from '@/features/reportes/components/pagos-usuario-tab'
import { ReportesTabs } from '@/features/reportes/components/reportes-tabs'
import { PageHeader } from '@/components/page-header'
import { TabsContent } from '@/components/ui/tabs'

const TABS = ['usuario'] as const

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const t = first(sp.tab)
  const tab = TABS.find((x) => x === t) ?? 'usuario'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Consulta y genera reportes del fraccionamiento."
        breadcrumbs={[{ label: 'Reportes' }]}
      />
      <ReportesTabs tab={tab}>
        <TabsContent value="usuario">
          {tab === 'usuario' && (
            <PagosUsuarioTab
              usuario={first(sp.usuario)}
              inicio={first(sp.inicio)}
              fin={first(sp.fin)}
              metodo={first(sp.metodo)}
            />
          )}
        </TabsContent>
      </ReportesTabs>
    </div>
  )
}
