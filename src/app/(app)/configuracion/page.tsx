import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { TabsContent } from '@/components/ui/tabs'
import { TABS_CONFIGURACION, type TabConfiguracion } from '@/features/catalogos/catalogos'
import { CatalogoSection } from '@/features/catalogos/components/catalogo-section'
import { CatalogosTabs } from '@/features/catalogos/components/catalogos-tabs'
import { TiposCuotaSection } from '@/features/catalogos/components/tipos-cuota-section'
import { listarPerfilesDe } from '@/features/catalogos/access-core'
import { listConceptosExtraCatalogo, listMediosHabilitados, listTiposCuota } from '@/features/catalogos/queries'
import { SectionCard } from '@/components/section-card'
import { guardarReglasCobro } from '@/features/reglas-cobro/actions'
import { ReglasCobroForm } from '@/features/reglas-cobro/components/reglas-cobro-form'
import { obtenerReglasCobro } from '@/features/reglas-cobro/queries'
import { listConceptosDescuento, listConceptosRecargo } from '@/features/cuotas/queries'
import { AuthorizationError, requireRole } from '@/lib/auth/require-role'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { ROLES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

async function contenido(tab: TabConfiguracion) {
  const supabase = await createClient()
  switch (tab) {
    case 'reglas': {
      const [reglas, recargos] = await Promise.all([obtenerReglasCobro(null), listConceptosRecargo(supabase)])
      return (
        <SectionCard
          title="Reglas de cobro"
          description="Cuándo se generan y vencen las cuotas, cuánta gracia hay, el recargo y cuántas cuotas vencidas restringen el acceso."
        >
          <ReglasCobroForm
            reglas={reglas}
            conceptos={recargos.map((r) => ({ id: r.id, nombre: r.nombre, monto: Number(r.monto_recargo) }))}
            guardar={guardarReglasCobro}
          />
        </SectionCard>
      )
    }
    case 'cuotas': {
      const fid = (await getTenantContext())?.fraccionamiento?.id
      const { data, error } = fid
        ? await supabase.from('fraccionamientos').select('instalacion_id').eq('id', fid).maybeSingle()
        : { data: null, error: null }
      if (error) throw new Error(`No se pudo leer la instalación: ${error.message}`)
      const instalacionId = data?.instalacion_id ?? null
      const [rows, mediosHabilitados, perfiles] = await Promise.all([
        listTiposCuota(supabase),
        listMediosHabilitados(supabase),
        instalacionId ? listarPerfilesDe(instalacionId) : Promise.resolve(null),
      ])
      return (
        <TiposCuotaSection
          rows={rows}
          mediosHabilitados={mediosHabilitados}
          perfiles={perfiles}
          tieneInstalacion={instalacionId !== null}
        />
      )
    }
    case 'extras':
      return <CatalogoSection catalogo="extras" rows={await listConceptosExtraCatalogo(supabase)} />
    case 'descuentos': {
      const rows = await listConceptosDescuento(supabase)
      return (
        <CatalogoSection
          catalogo="descuentos"
          rows={rows.map((r) => ({ id: r.id, nombre: r.nombre, importe: Number(r.monto_descuento) }))}
        />
      )
    }
    case 'recargos': {
      const rows = await listConceptosRecargo(supabase)
      return (
        <CatalogoSection
          catalogo="recargos"
          rows={rows.map((r) => ({ id: r.id, nombre: r.nombre, importe: Number(r.monto_recargo) }))}
        />
      )
    }
  }
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  try {
    await requireRole(ROLES.ADMINISTRADOR)
  } catch (e) {
    if (e instanceof AuthorizationError) notFound()
    throw e
  }

  const t = first((await searchParams).tab)
  const tab = TABS_CONFIGURACION.find((x) => x === t) ?? 'cuotas'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Administra los catálogos del fraccionamiento (tipos de cuota, pagos extra, descuentos y recargos) y sus reglas de cobro."
        breadcrumbs={[{ label: 'Configuración' }]}
      />
      {/* Solo se leen los datos de la pestaña activa. */}
      <CatalogosTabs tab={tab}>
        <TabsContent value={tab}>{await contenido(tab)}</TabsContent>
      </CatalogosTabs>
    </div>
  )
}
