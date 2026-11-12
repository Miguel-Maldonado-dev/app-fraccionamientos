import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { notFound } from 'next/navigation'
import { PageBreadcrumb } from '@/components/page-breadcrumb'
import { Button } from '@/components/ui/button'
import { AccesosSection } from '@/features/accesos/components/accesos-section'
import { listTarjetas, listTelefonos } from '@/features/accesos/queries'
import { SyncEstado } from '@/features/accesos/components/sync-estado'
import { listBotonesConfigurados, listControles } from '@/features/controles/queries'
import { DomicilioInfoCard } from '@/features/domicilios/components/domicilio-info-card'
import { EditDomicilioDialog } from '@/features/domicilios/components/edit-domicilio-dialog'
import { getDomicilioConsola } from '@/features/domicilios/queries'
import {
  actualizarControlEnFraccionamiento,
  actualizarDomicilioEnFraccionamiento,
  actualizarResidenteEnFraccionamiento,
  actualizarTarjetaEnFraccionamiento,
  actualizarTelefonoEnFraccionamiento,
  crearControlEnFraccionamiento,
  crearResidenteEnFraccionamiento,
  crearTarjetaEnFraccionamiento,
  crearTelefonoEnFraccionamiento,
  eliminarControlEnFraccionamiento,
  eliminarResidenteEnFraccionamiento,
  eliminarTarjetaEnFraccionamiento,
  eliminarTelefonoEnFraccionamiento,
  fijarPinDomicilioEnFraccionamiento,
  generarPinDomicilioEnFraccionamiento,
  quitarPinDomicilioEnFraccionamiento,
} from '@/features/fraccionamientos/operacion-actions'
import { getFraccionamiento } from '@/features/fraccionamientos/queries'
import { domicilioSincronizado, getPinDomicilio } from '@/features/pin/queries'
import { ResidentesSection } from '@/features/residentes/components/residentes-section'
import { listResidentesDomicilio } from '@/features/residentes/queries'
import { reintentarTareaEnFraccionamiento } from '@/features/sincronizacion/actions'
import { estadoDeEntidades, estadoDomicilio } from '@/features/sincronizacion/queries'
import { requireSuperAdminPage } from '@/lib/auth/require-super-admin-page'
import { parseRouteId } from '@/lib/route-id'
import { createClient } from '@/lib/supabase/server'

/** Detalle de un domicilio en la consola: datos, residentes y medios de acceso. Nunca cuotas ni pagos. */
export default async function DomicilioConsolaPage({
  params,
}: {
  params: Promise<{ id: string; domicilioId: string }>
}) {
  await requireSuperAdminPage()

  const raw = await params
  const fid = parseRouteId(raw.id)
  const domicilioId = parseRouteId(raw.domicilioId)
  if (fid === null || domicilioId === null) notFound()

  const supabase = await createClient()
  const [fraccionamiento, domicilio] = await Promise.all([
    getFraccionamiento(supabase, fid),
    getDomicilioConsola(supabase, domicilioId),
  ])
  // RLS deja ver todo al super admin: el domicilio debe pertenecer al fraccionamiento de la URL.
  if (!fraccionamiento || !domicilio || domicilio.fraccionamientoId !== fid) notFound()

  // Sin permiso de acceso: su nombre (p. ej. "Morosos") revelaría el estado de pago, que la consola nunca muestra.
  // El super admin sí ve el PIN (como administrador y tesorero).
  const [telefonos, tarjetas, controles, botonesConfigurados, pin, sincronizado, residentes, estadoDom] =
    await Promise.all([
      listTelefonos(supabase, domicilioId),
      listTarjetas(supabase, domicilioId),
      listControles(supabase, domicilioId),
      listBotonesConfigurados(supabase, fid),
      getPinDomicilio(supabase, domicilioId),
      domicilioSincronizado(supabase, domicilioId),
      listResidentesDomicilio(supabase, domicilioId),
      estadoDomicilio(supabase, fid, domicilioId, { consola: true }),
    ])
  const [estados, estadosControles] = await Promise.all([
    estadoDeEntidades(
      supabase,
      fid,
      'tarjeta',
      tarjetas.map((t) => t.id),
    ),
    estadoDeEntidades(
      supabase,
      fid,
      'control',
      controles.map((c) => c.id),
    ),
  ])
  const reintentar = reintentarTareaEnFraccionamiento.bind(null, fid)

  const volver = `/admin/fraccionamientos/${fid}?tab=domicilios`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href={volver}>
            <ArrowLeft />
            Volver
          </Link>
        </Button>
        <PageBreadcrumb
          items={[
            { label: 'Fraccionamientos', href: '/admin/fraccionamientos' },
            { label: fraccionamiento.nombre, href: `/admin/fraccionamientos/${fid}` },
            { label: domicilio.direccion ?? '' },
          ]}
        />
      </div>
      <DomicilioInfoCard
        domicilio={domicilio}
        mostrarEstatus={false}
        sincronizacion={estadoDom ? <SyncEstado estado={estadoDom} reintentar={reintentar} /> : undefined}
        action={
          <EditDomicilioDialog
            domicilio={domicilio}
            conceptos={[]}
            conceptoActual={domicilio.id_concepto}
            editarTipoCuota={false}
            actualizar={actualizarDomicilioEnFraccionamiento.bind(null, fid)}
            trigger={
              <Button variant="secondary" size="icon-sm" aria-label="Editar domicilio" title="Editar domicilio">
                <Pencil />
              </Button>
            }
          />
        }
      />
      <AccesosSection
        domicilio={domicilio}
        medios={domicilio.medios ?? []}
        telefonos={telefonos}
        tarjetas={tarjetas}
        controles={controles}
        botonesConfigurados={botonesConfigurados}
        estados={estados}
        estadosControles={estadosControles}
        pin={{ valor: pin, sincronizado }}
        acciones={{
          crearTelefono: crearTelefonoEnFraccionamiento.bind(null, fid),
          actualizarTelefono: actualizarTelefonoEnFraccionamiento.bind(null, fid),
          eliminarTelefono: eliminarTelefonoEnFraccionamiento.bind(null, fid),
          crearTarjeta: crearTarjetaEnFraccionamiento.bind(null, fid),
          actualizarTarjeta: actualizarTarjetaEnFraccionamiento.bind(null, fid),
          eliminarTarjeta: eliminarTarjetaEnFraccionamiento.bind(null, fid),
          crearControl: crearControlEnFraccionamiento.bind(null, fid),
          actualizarControl: actualizarControlEnFraccionamiento.bind(null, fid),
          eliminarControl: eliminarControlEnFraccionamiento.bind(null, fid),
          fijarPin: fijarPinDomicilioEnFraccionamiento.bind(null, fid),
          generarPin: generarPinDomicilioEnFraccionamiento.bind(null, fid),
          quitarPin: quitarPinDomicilioEnFraccionamiento.bind(null, fid),
          reintentarTarea: reintentar,
        }}
      />
      <ResidentesSection
        domicilioId={domicilioId}
        residentes={residentes}
        acciones={{
          crear: crearResidenteEnFraccionamiento.bind(null, fid),
          actualizar: actualizarResidenteEnFraccionamiento.bind(null, fid),
          eliminar: eliminarResidenteEnFraccionamiento.bind(null, fid),
        }}
      />
    </div>
  )
}
