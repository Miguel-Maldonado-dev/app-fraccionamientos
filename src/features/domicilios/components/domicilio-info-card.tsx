import type { ReactNode } from 'react'
import { Building2, CalendarDays, FileText, House, KeyRound, type LucideIcon } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { DomicilioInfo, PermisoDomicilio } from '../queries'

function Field({
  icon: Icon,
  label,
  muted,
  children,
}: {
  icon: LucideIcon
  label: string
  muted?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 md:px-6 md:first:pl-0 md:last:pr-0">
      <Icon className="mt-0.5 size-6 shrink-0 text-secondary-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn('text-[15px] font-semibold break-words', muted && 'font-normal text-muted-foreground')}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Encabezado del detalle: identifica el domicilio y sus datos generales; `action` va en la esquina superior derecha. */
export function DomicilioInfoCard({
  domicilio,
  action,
  mostrarEstatus = true,
  permiso = null,
  sincronizacion,
}: {
  domicilio: DomicilioInfo
  action?: ReactNode
  /** La consola del super admin no muestra el estado de pago. */
  mostrarEstatus?: boolean
  /**
   * Permiso de acceso en access-core; `null` si el fraccionamiento no tiene instalación. Solo lo pasa el
   * fraccionamiento: en la consola revelaría si el domicilio es moroso.
   */
  permiso?: PermisoDomicilio | null
  /** Estado de sincronización del domicilio (un `SyncBadge`); se muestra aunque no haya permiso. */
  sincronizacion?: ReactNode
}) {
  const mostrarAcceso = permiso != null || sincronizacion != null
  const columnas = 2 + (mostrarEstatus ? 1 : 0) + (mostrarAcceso ? 1 : 0)
  return (
    <Card className="gap-6 p-5 md:p-6">
      <div className="flex items-start gap-4 sm:items-center sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary sm:size-16">
          <House className="size-6 sm:size-8" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight break-words md:text-[28px] md:leading-9">
            {domicilio.direccion ?? 'Domicilio'}
          </h1>
          <p className="text-sm text-secondary-foreground">Domicilio del fraccionamiento.</p>
        </div>
        {action ? <div className="shrink-0 self-start">{action}</div> : null}
      </div>
      <div
        className={cn(
          'grid gap-5 md:gap-0 md:divide-x md:divide-border',
          { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[columnas],
        )}
      >
        <Field icon={CalendarDays} label="Fecha de registro">
          {formatDate(domicilio.fecha_alta)}
        </Field>
        <Field icon={FileText} label="Tipo de cuota mensual" muted={!domicilio.tipo_cuota}>
          {domicilio.tipo_cuota ?? 'Sin asignar'}
        </Field>
        {mostrarEstatus && (
          <Field icon={Building2} label="Estatus">
            <StatusBadge status={domicilio.estatus} />
          </Field>
        )}
        {mostrarAcceso && (
          <Field icon={KeyRound} label="Acceso" muted={permiso != null && !permiso.nombre}>
            <div className="flex flex-wrap items-center gap-2">
              {permiso ? <span>Permiso: {permiso.nombre ?? 'Sin asignar'}</span> : null}
              {permiso?.pendiente ? (
                <Badge variant="warning" dot>
                  Pendiente
                </Badge>
              ) : null}
              {sincronizacion}
            </div>
          </Field>
        )}
      </div>
    </Card>
  )
}
