import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { notFound } from 'next/navigation'
import { PageBreadcrumb } from '@/components/page-breadcrumb'
import { Button } from '@/components/ui/button'
import { AccesosSection } from '@/features/accesos/components/accesos-section'
import { listTarjetas, listTelefonos } from '@/features/accesos/queries'
import { SyncEstado } from '@/features/accesos/components/sync-estado'
import { listTiposCuota } from '@/features/catalogos/queries'
import { listBotonesConfigurados, listControles } from '@/features/controles/queries'
import { CuotasSection } from '@/features/cuotas/components/cuotas-section'
import {
  listAnios,
  listConceptosDescuento,
  listConceptosRecargo,
  listCuotasDomicilio,
  listMeses,
} from '@/features/cuotas/queries'
import { AccesoForzado } from '@/features/domicilios/components/acceso-forzado'
import { DomicilioInfoCard } from '@/features/domicilios/components/domicilio-info-card'
import { EditDomicilioDialog } from '@/features/domicilios/components/edit-domicilio-dialog'
import {
  getDomicilioConcepto,
  getDomicilioInfo,
  getEstadoAccesoDomicilio,
  getPermisoDomicilio,
  listConceptosRecurrentes,
  listDomiciliosOptions,
} from '@/features/domicilios/queries'
import { PagosExtraSection } from '@/features/pagos/components/pagos-extra-section'
import { ReciboPorCuota } from '@/features/pagos/components/recibo-por-cuota'
import { RegistrarPagoCuotaDialog } from '@/features/pagos/components/registrar-pago-cuota-dialog'
import { listConceptosExtra, listMetodosPago, listPagosExtraDomicilio } from '@/features/pagos/queries'
import { domicilioSincronizado, getPinDomicilio } from '@/features/pin/queries'
import { ResidentesSection } from '@/features/residentes/components/residentes-section'
import { getMaxResidentesApp, listDispositivos, listResidentesDomicilio } from '@/features/residentes/queries'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { hasRole } from '@/lib/auth/require-role'
import { ROLES, ROLES_GESTION } from '@/lib/constants'
import { parseRouteId } from '@/lib/route-id'
import { createClient } from '@/lib/supabase/server'
import { estadoDeEntidades, estadoDomicilio } from '@/features/sincronizacion/queries'

export default async function DomicilioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const domicilioId = parseRouteId(id)
  if (domicilioId === null) notFound()

  const supabase = await createClient()
  const domicilio = await getDomicilioInfo(supabase, domicilioId)
  if (!domicilio) notFound()

  const user = await getCurrentUser()
  const [
    concepto,
    conceptos,
    telefonos,
    tarjetas,
    residentes,
    cuotas,
    conceptosDescuento,
    conceptosRecargo,
    anios,
    meses,
    metodos,
    pagosExtra,
    domicilios,
    conceptosExtra,
    tiposCuota,
    controles,
    botonesConfigurados,
    sincronizado,
    permiso,
    estadoDom,
    estadoAcceso,
  ] = await Promise.all([
    getDomicilioConcepto(supabase, domicilioId),
    listConceptosRecurrentes(supabase),
    listTelefonos(supabase, domicilioId),
    listTarjetas(supabase, domicilioId),
    listResidentesDomicilio(supabase, domicilioId),
    listCuotasDomicilio(supabase, domicilioId),
    listConceptosDescuento(supabase),
    listConceptosRecargo(supabase),
    listAnios(supabase),
    listMeses(supabase),
    listMetodosPago(supabase),
    listPagosExtraDomicilio(supabase, domicilioId),
    listDomiciliosOptions(supabase),
    listConceptosExtra(supabase),
    listTiposCuota(supabase),
    listControles(supabase, domicilioId),
    listBotonesConfigurados(supabase, null),
    domicilioSincronizado(supabase, domicilioId),
    getPermisoDomicilio(supabase, domicilioId),
    estadoDomicilio(supabase, null, domicilioId),
    // La RPC solo admite administrador y tesorero; comité y vigilancia no ven el bloque.
    hasRole(user, ROLES_GESTION) ? getEstadoAccesoDomicilio(supabase, domicilioId) : Promise.resolve(null),
  ])
  const puedeGestionar = hasRole(user, ROLES_GESTION)
  const medios = domicilio.medios ?? []
  // Comité y vigilancia no leen `pines_acceso` (RLS les da 0 filas, que parecería "sin PIN"): `undefined`.
  const [estados, estadosControles, pin] = await Promise.all([
    estadoDeEntidades(
      supabase,
      null,
      'tarjeta',
      tarjetas.map((t) => t.id),
    ),
    estadoDeEntidades(
      supabase,
      null,
      'control',
      controles.map((c) => c.id),
    ),
    puedeGestionar && medios.includes('pin') ? getPinDomicilio(supabase, domicilioId) : undefined,
  ])
  const maxResidentesApp = puedeGestionar ? await getMaxResidentesApp(supabase) : undefined
  const dispositivos = puedeGestionar
    ? await listDispositivos(
        supabase,
        residentes.flatMap((r) => (r.user_id ? [r.user_id] : [])),
      )
    : undefined

  const mediosPorConcepto = Object.fromEntries(tiposCuota.map((t) => [t.id, t.medios]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/domicilios">
            <ArrowLeft />
            Volver
          </Link>
        </Button>
        <PageBreadcrumb items={[{ label: 'Domicilios', href: '/domicilios' }, { label: domicilio.direccion ?? '' }]} />
      </div>
      <DomicilioInfoCard
        domicilio={domicilio}
        permiso={permiso}
        sincronizacion={estadoDom ? <SyncEstado estado={estadoDom} puedeReintentar={puedeGestionar} /> : undefined}
        action={
          <EditDomicilioDialog
            domicilio={domicilio}
            conceptos={conceptos}
            conceptoActual={concepto?.concepto_id ?? null}
            mediosPorConcepto={mediosPorConcepto}
            registros={{ tarjeta: tarjetas.length, control: controles.length }}
            trigger={
              <Button variant="secondary" size="icon-sm" aria-label="Editar domicilio" title="Editar domicilio">
                <Pencil />
              </Button>
            }
          />
        }
      />
      {estadoAcceso ? (
        <AccesoForzado domicilioId={domicilioId} estado={estadoAcceso} puedeAjustar={hasRole(user, [ROLES.ADMINISTRADOR])} />
      ) : null}
      <AccesosSection
        domicilio={domicilio}
        medios={medios}
        telefonos={telefonos}
        tarjetas={tarjetas}
        controles={controles}
        botonesConfigurados={botonesConfigurados}
        estados={estados}
        estadosControles={estadosControles}
        pin={{ valor: pin, sincronizado }}
        puedeReintentar={puedeGestionar}
      />
      <ResidentesSection
        domicilioId={domicilioId}
        residentes={residentes}
        accesoApp={maxResidentesApp === undefined ? undefined : { max: maxResidentesApp }}
        puedeAgregar={hasRole(user, [ROLES.ADMINISTRADOR])}
        dispositivos={dispositivos}
        puedeDesligar={hasRole(user, [ROLES.ADMINISTRADOR])}
      />
      <CuotasSection
        domicilioId={domicilioId}
        cuotas={cuotas}
        puedeGestionar={puedeGestionar}
        anios={anios}
        meses={meses}
        conceptosDescuento={conceptosDescuento}
        conceptosRecargo={conceptosRecargo}
        renderPagar={(c) => (
          <RegistrarPagoCuotaDialog cuota={c} metodos={metodos} trigger={<Button variant="secondary" size="sm">
                Pagar
              </Button>} />
        )}
        renderRecibo={(c) => <ReciboPorCuota cuotaId={c.id!} />}
      />
      <PagosExtraSection
        domicilioId={domicilioId}
        pagos={pagosExtra}
        puedeGestionar={puedeGestionar}
        domicilios={domicilios}
        conceptos={conceptosExtra}
        metodos={metodos}
      />
    </div>
  )
}
