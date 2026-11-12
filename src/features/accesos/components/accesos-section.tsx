import { CreditCard, Info, Phone, Plus } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { SectionCard } from '@/components/section-card'
import { Button } from '@/components/ui/button'
import type { DomicilioInfo } from '@/features/domicilios/queries'
import type { EstadoEntidad } from '@/features/sincronizacion/queries'
import { LIMITES, type MedioAcceso } from '@/lib/constants'
import type { Tables } from '@/lib/supabase/types'
import { ControlesCard } from '@/features/controles/components/controles-card'
import { PinCard } from '@/features/pin/components/pin-card'
import type { AccionesAccesos } from './acciones'
import { AccesoItem } from './acceso-item'
import { NumeroDialog } from './numero-dialog'
import { TarjetaDialog } from './tarjeta-dialog'

export const MSG_SIN_TIPO_CUOTA = 'Asigna un tipo de cuota para habilitar los medios de acceso'
export const MSG_TELEFONO_SIN_SYNC = 'Se sincronizará cuando access-core lo soporte'

/** Medios que tienen tarjeta en esta sección (QR aún no). */
const MEDIOS_CON_TARJETA: readonly MedioAcceso[] = ['telefono', 'tarjeta', 'control', 'pin']

/**
 * Medios de acceso del domicilio: una tarjeta por cada medio del tipo de cuota (`medios`). Los
 * registros de medios que el tipo no incluye se conservan en la base pero no se muestran.
 */
export function AccesosSection({
  domicilio,
  medios,
  telefonos,
  tarjetas,
  controles = [],
  botonesConfigurados = [],
  estados = new Map(),
  estadosControles = new Map(),
  pin = { valor: undefined, sincronizado: false },
  puedeReintentar = true,
  acciones,
}: {
  domicilio: DomicilioInfo
  /** Medios del tipo de cuota del domicilio (`domicilios_info.medios`). */
  medios: MedioAcceso[]
  telefonos: Tables<'telefonos_acceso'>[]
  tarjetas: Tables<'tarjetas_acceso'>[]
  controles?: Tables<'controles_acceso'>[]
  /** Botones (0..3) con salida configurada en el fraccionamiento. */
  botonesConfigurados?: number[]
  /** Estado de sincronización de cada tarjeta, por id. */
  estados?: Map<number, EstadoEntidad>
  /** Estado de sincronización de cada control, por id. */
  estadosControles?: Map<number, EstadoEntidad>
  /**
   * PIN guardado (`null` = sin PIN; `undefined` = el rol no puede verlo) y si el domicilio ya existe
   * en access-core.
   */
  pin?: { valor: string | null | undefined; sincronizado: boolean }
  /** Con `false` (roles sin gestión) los errores de sincronización no ofrecen "Reintentar". */
  puedeReintentar?: boolean
  /** Por defecto, las del fraccionamiento. */
  acciones?: AccionesAccesos
}) {
  const domicilioId = domicilio.id!
  if (medios.length === 0 && domicilio.id_concepto == null) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        {MSG_SIN_TIPO_CUOTA}
      </p>
    )
  }
  if (!MEDIOS_CON_TARJETA.some((m) => medios.includes(m))) return null

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {medios.includes('telefono') && (
        <SectionCard
          title="Números de acceso"
          description="Máximo 2 números"
          icon={Phone}
          action={
            telefonos.length < LIMITES.TELEFONOS && (
              <NumeroDialog
                domicilioId={domicilioId}
                acciones={acciones}
                trigger={
                  <Button size="sm">
                    <Plus />
                    Agregar Número
                  </Button>
                }
              />
            )
          }
        >
          <p className="mb-3 text-xs text-muted-foreground">{MSG_TELEFONO_SIN_SYNC}</p>
          {telefonos.length === 0 ? (
            <EmptyState icon={Phone} title="Sin números" description="No hay números registrados para el acceso." />
          ) : (
            <ul className="flex flex-col gap-2">
              {telefonos.map((t) => (
                <AccesoItem
                  key={t.id}
                  kind="telefono"
                  domicilioId={domicilioId}
                  id={t.id}
                  valor={t.telefono}
                  acciones={acciones}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      )}
      {medios.includes('tarjeta') && (
        <SectionCard
          title="Tarjetas de acceso"
          description="Máximo 3 tarjetas"
          icon={CreditCard}
          action={
            tarjetas.length < LIMITES.TARJETAS && (
              <TarjetaDialog
                domicilioId={domicilioId}
                acciones={acciones}
                trigger={
                  <Button size="sm">
                    <Plus />
                    Agregar Tarjeta
                  </Button>
                }
              />
            )
          }
        >
          {tarjetas.length === 0 ? (
            <EmptyState icon={CreditCard} title="Sin tarjetas" description="No hay tarjetas registradas para el acceso." />
          ) : (
            <ul className="flex flex-col gap-2">
              {tarjetas.map((t) => (
                <AccesoItem
                  key={t.id}
                  kind="tarjeta"
                  domicilioId={domicilioId}
                  id={t.id}
                  valor={t.numero}
                  descripcion={t.descripcion}
                  estado={estados.get(t.id)}
                  puedeReintentar={puedeReintentar}
                  acciones={acciones}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      )}
      {medios.includes('control') && (
        <ControlesCard
          domicilioId={domicilioId}
          controles={controles}
          botonesConfigurados={botonesConfigurados}
          estados={estadosControles}
          puedeReintentar={puedeReintentar}
          reintentar={acciones?.reintentarTarea}
          acciones={acciones}
        />
      )}
      {medios.includes('pin') && (
        <PinCard domicilioId={domicilioId} pin={pin.valor} sincronizado={pin.sincronizado} acciones={acciones} />
      )}
    </div>
  )
}
