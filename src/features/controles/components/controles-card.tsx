'use client'

import { Pencil, Plus, RadioTower, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { SectionCard } from '@/components/section-card'
import { Button } from '@/components/ui/button'
import { SyncEstado } from '@/features/accesos/components/sync-estado'
import type { EstadoEntidad } from '@/features/sincronizacion/queries'
import type { ActionResult } from '@/lib/action-result'
import { LIMITES } from '@/lib/constants'
import type { Tables } from '@/lib/supabase/types'
import { actualizarControl, crearControl, eliminarControl } from '../actions'
import { MSG_CONTROL_ELIMINADO, MSG_SIN_BOTONES_CONFIGURADOS } from '../messages'
import { etiquetaBoton, type BotonGuardado } from '../schemas'
import { ControlDialog, type AccionesControl } from './control-dialog'

export type AccionesControles = AccionesControl & {
  eliminarControl: (id: number, domicilioId: number) => Promise<ActionResult>
}

const ACCIONES_FRACCIONAMIENTO: AccionesControles = { crearControl, actualizarControl, eliminarControl }

/**
 * Controles RF del domicilio (máximo `LIMITES.CONTROLES`). Sin botones con salida configurada en el
 * fraccionamiento no se pueden agregar: el super admin debe configurarlos antes.
 */
export function ControlesCard({
  domicilioId,
  controles,
  botonesConfigurados,
  estados = new Map(),
  puedeReintentar = true,
  reintentar,
  acciones = ACCIONES_FRACCIONAMIENTO,
}: {
  domicilioId: number
  controles: Tables<'controles_acceso'>[]
  /** Botones (0..3) con salida configurada en `fraccionamiento_botones`. */
  botonesConfigurados: number[]
  /** Estado de sincronización de cada control, por id. */
  estados?: Map<number, EstadoEntidad>
  puedeReintentar?: boolean
  /** Por defecto, el reintento del fraccionamiento. */
  reintentar?: (id: string) => Promise<ActionResult>
  acciones?: AccionesControles
}) {
  const sinBotones = botonesConfigurados.length === 0
  const agregar = <Button size="sm" disabled={sinBotones} title={sinBotones ? MSG_SIN_BOTONES_CONFIGURADOS : undefined}>
    <Plus />
    Agregar control
  </Button>

  return (
    <SectionCard
      title="Controles"
      description={`Máximo ${LIMITES.CONTROLES} controles`}
      icon={RadioTower}
      action={
        controles.length < LIMITES.CONTROLES &&
        (sinBotones ? (
          agregar
        ) : (
          <ControlDialog
            domicilioId={domicilioId}
            botonesConfigurados={botonesConfigurados}
            acciones={acciones}
            trigger={agregar}
          />
        ))
      }
    >
      {sinBotones && <p className="mb-3 text-xs text-muted-foreground">{MSG_SIN_BOTONES_CONFIGURADOS}</p>}
      {controles.length === 0 ? (
        <EmptyState icon={RadioTower} title="Sin controles" description="No hay controles registrados para el acceso." />
      ) : (
        <ul className="flex flex-col gap-2">
          {controles.map((c, i) => (
            <ControlItem
              key={c.id}
              domicilioId={domicilioId}
              control={c}
              nombre={c.descripcion || `Control ${i + 1}`}
              botonesConfigurados={botonesConfigurados}
              estado={estados.get(c.id)}
              puedeReintentar={puedeReintentar}
              reintentar={reintentar}
              acciones={acciones}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function ControlItem({
  domicilioId,
  control,
  nombre,
  botonesConfigurados,
  estado,
  puedeReintentar,
  reintentar,
  acciones,
}: {
  domicilioId: number
  control: Tables<'controles_acceso'>
  nombre: string
  botonesConfigurados: number[]
  estado?: EstadoEntidad
  puedeReintentar: boolean
  reintentar?: (id: string) => Promise<ActionResult>
  acciones: AccionesControles
}) {
  const router = useRouter()
  const botones = ((control.botones ?? []) as unknown as BotonGuardado[]).slice().sort((a, b) => a.boton - b.boton)

  async function onConfirm() {
    const result = await acciones.eliminarControl(control.id, domicilioId)
    if (!result.ok) throw new Error(result.error)
    toast.success(MSG_CONTROL_ELIMINADO)
    router.refresh()
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <RadioTower className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{nombre}</span>
          <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
            {botones.map((b) => (
              <span key={b.boton}>{`${etiquetaBoton(b.boton)} · ${b.rf_code}`}</span>
            ))}
          </span>
        </div>
        <SyncEstado estado={estado} reintentar={reintentar} puedeReintentar={puedeReintentar} />
      </div>
      <div className="flex shrink-0 gap-1">
        <ControlDialog
          domicilioId={domicilioId}
          botonesConfigurados={botonesConfigurados}
          item={{ id: control.id, descripcion: control.descripcion, botones }}
          acciones={acciones}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${nombre}`}>
              <Pencil />
            </Button>
          }
        />
        <ConfirmDialog
          title="Eliminar control"
          description="¿Deseas eliminar este control? Se dará de baja en access-core."
          confirmLabel="Eliminar"
          onConfirm={onConfirm}
          trigger={
            <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`Eliminar ${nombre}`}>
              <Trash2 />
            </Button>
          }
        />
      </div>
    </li>
  )
}
