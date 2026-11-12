import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { SectionCard } from '@/components/section-card'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { AddDomicilioDialog } from '@/features/domicilios/components/add-domicilio-dialog'
import { DomiciliosView } from '@/features/domicilios/components/domicilios-view'
import { listDomiciliosConsola, listTiposCuotaConsola } from '@/features/domicilios/queries'
import { guardarReglasCobroConsola } from '@/features/reglas-cobro/actions'
import { ReglasCobroForm } from '@/features/reglas-cobro/components/reglas-cobro-form'
import { obtenerReglasCobro } from '@/features/reglas-cobro/queries'
import { listConceptosRecargo } from '@/features/cuotas/queries'
import { PanelSincronizacion } from '@/features/sincronizacion/components/panel-sincronizacion'
import { procesarAhoraEnFraccionamiento, reintentarTareaEnFraccionamiento } from '@/features/sincronizacion/actions'
import { listTareasAbiertas, resumenSincronizacion } from '@/features/sincronizacion/queries'
import { listarInstalacionesDisponibles, listarSalidasDe } from '@/features/fraccionamientos/access-core'
import { guardarBotonesDeFraccionamiento } from '@/features/fraccionamientos/botones-actions'
import { BotonesFraccionamiento } from '@/features/fraccionamientos/components/botones-fraccionamiento'
import { MediosFraccionamiento } from '@/features/fraccionamientos/components/medios-fraccionamiento'
import { guardarMediosDeFraccionamiento } from '@/features/fraccionamientos/medios-actions'
import { FraccionamientoDialog } from '@/features/fraccionamientos/components/fraccionamiento-dialog'
import { FraccionamientoTabs } from '@/features/fraccionamientos/components/fraccionamiento-tabs'
import { getFraccionamiento, listBotones, listMedios } from '@/features/fraccionamientos/queries'
import { TABS_FRACCIONAMIENTO } from '@/features/fraccionamientos/tabs'
import { crearDomicilioEnFraccionamiento } from '@/features/fraccionamientos/operacion-actions'
import {
  cambiarEstadoUsuarioEnFraccionamiento,
  crearUsuarioEnFraccionamiento,
} from '@/features/fraccionamientos/usuarios-actions'
import { AddUserDialog } from '@/features/usuarios/components/add-user-dialog'
import { UsuariosView } from '@/features/usuarios/components/usuarios-view'
import { listUsuarios } from '@/features/usuarios/queries'
import { parseRouteId } from '@/lib/route-id'
import { requireSuperAdminPage } from '@/lib/auth/require-super-admin-page'
import { createClient } from '@/lib/supabase/server'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function FraccionamientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    tab?: string | string[]
    estado?: string | string[]
  }>
}) {
  await requireSuperAdminPage()

  const id = parseRouteId((await params).id)
  if (id === null) notFound()

  const supabase = await createClient()
  const fraccionamiento = await getFraccionamiento(supabase, id)
  if (!fraccionamiento) notFound()

  const sp = await searchParams
  const t = first(sp.tab)
  const tab = TABS_FRACCIONAMIENTO.find((x) => x === t) ?? 'domicilios'

  let contenido: React.ReactNode
  let conceptos: Awaited<ReturnType<typeof listTiposCuotaConsola>> = []
  if (tab === 'domicilios') {
    const [domicilios, tiposCuota] = await Promise.all([
      listDomiciliosConsola(supabase, id),
      listTiposCuotaConsola(supabase, id),
    ])
    conceptos = tiposCuota
    contenido = (
      <div className="space-y-4">
        {conceptos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            El administrador del fraccionamiento debe capturar los tipos de cuota primero.
          </p>
        )}
        <DomiciliosView
          rows={domicilios}
          mostrarEstatus={false}
          mostrarTipoCuota
          emptyDescription="Aún no hay domicilios registrados en este fraccionamiento."
          hrefBase={`/admin/fraccionamientos/${id}/domicilios`}
        />
      </div>
    )
  } else if (tab === 'usuarios') {
    const estado = first(sp.estado) === 'inactivos' ? 'inactivos' : 'activos'
    const rows = await listUsuarios(supabase, estado === 'activos', id)
    contenido = (
      <UsuariosView
        rows={rows}
        // El super admin no es usuario de este fraccionamiento: no hay "usuario actual" en la tabla.
        currentUserId=""
        estado={estado}
        cambiarEstado={cambiarEstadoUsuarioEnFraccionamiento.bind(null, id)}
        permitirEditar={false}
      />
    )
  } else if (tab === 'cobro') {
    // Solo las reglas: la consola no muestra pagos ni morosidad.
    const [reglas, recargos] = await Promise.all([obtenerReglasCobro(id), listConceptosRecargo(supabase, id)])
    contenido = (
      <SectionCard
        title="Reglas de cobro"
        description="Generación, vencimiento, gracia, recargo y umbral de morosidad de este fraccionamiento."
      >
        <ReglasCobroForm
          reglas={reglas}
          conceptos={recargos.map((r) => ({ id: r.id, nombre: r.nombre, monto: Number(r.monto_recargo) }))}
          guardar={guardarReglasCobroConsola.bind(null, id)}
        />
      </SectionCard>
    )
  } else {
    const [medios, botones, salidas, resumenSync, tareasSync] = await Promise.all([
      listMedios(supabase, id),
      listBotones(supabase, id),
      fraccionamiento.instalacionId ? listarSalidasDe(fraccionamiento.instalacionId) : Promise.resolve(null),
      resumenSincronizacion(supabase, id),
      listTareasAbiertas(supabase, id, { consola: true }),
    ])
    contenido = (
      <div className="space-y-6">
        <SectionCard
          title="Medios habilitados"
          description="Medios con los que los domicilios de este fraccionamiento pueden entrar."
        >
          <MediosFraccionamiento habilitados={medios} guardar={guardarMediosDeFraccionamiento.bind(null, id)} />
        </SectionCard>
        <SectionCard
          title="Botones de los controles"
          description="Salida de la instalación que abre cada botón de los controles RF."
        >
          {fraccionamiento.instalacionId ? (
            <BotonesFraccionamiento
              salidas={salidas}
              botones={botones}
              guardar={guardarBotonesDeFraccionamiento.bind(null, id)}
            />
          ) : (
            <p className="text-sm text-secondary-foreground">
              Vincula una instalación de access-core para configurar los botones.
            </p>
          )}
        </SectionCard>
        <SectionCard title="Sincronización" description="Tareas pendientes o con error hacia access-core.">
          <PanelSincronizacion
            resumen={resumenSync}
            tareas={tareasSync}
            modo="consola"
            tieneInstalacion={Boolean(fraccionamiento.instalacionId)}
            mensajeSinInstalacion="Vincula una instalación de access-core para sincronizar."
            acciones={{
              procesar: procesarAhoraEnFraccionamiento.bind(null, id),
              reintentar: reintentarTareaEnFraccionamiento.bind(null, id),
            }}
          />
        </SectionCard>
      </div>
    )
  }

  const instalaciones = await listarInstalacionesDisponibles(supabase)

  return (
    <div className="space-y-6">
      <PageHeader
        title={fraccionamiento.nombre}
        breadcrumbs={[{ label: 'Fraccionamientos', href: '/admin/fraccionamientos' }, { label: fraccionamiento.nombre }]}
        homeHref="/admin"
        actions={
          <>
            <FraccionamientoDialog
              item={fraccionamiento}
              instalaciones={instalaciones}
              trigger={<Button variant="secondary">Editar fraccionamiento</Button>}
            />
            {tab === 'domicilios' &&
              (conceptos.length === 0 ? (
                <Button disabled>
                  <Plus /> Nuevo domicilio
                </Button>
              ) : (
                <AddDomicilioDialog
                  conceptos={conceptos}
                  mostrarImporte={false}
                  crear={crearDomicilioEnFraccionamiento.bind(null, id)}
                />
              ))}
            {tab === 'usuarios' && <AddUserDialog crear={crearUsuarioEnFraccionamiento.bind(null, id)} />}
          </>
        }
      />
      <FraccionamientoTabs id={id} tab={tab}>
        <TabsContent value={tab}>{contenido}</TabsContent>
      </FraccionamientoTabs>
    </div>
  )
}
