'use client'

import { CreditCard, Pencil, Phone, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { EstadoEntidad } from '@/features/sincronizacion/queries'
import { eliminarTarjeta, eliminarTelefono } from '../actions'
import { MSG_TARJETA_ELIMINADA, MSG_TELEFONO_ELIMINADO } from '../messages'
import type { AccionesAccesos } from './acciones'
import { NumeroDialog } from './numero-dialog'
import { SyncEstado } from './sync-estado'
import { TarjetaDialog } from './tarjeta-dialog'

export type AccesoKind = 'telefono' | 'tarjeta'

const KINDS = {
  telefono: { title: 'Eliminar Número', deleted: MSG_TELEFONO_ELIMINADO, remove: 'eliminarTelefono' },
  tarjeta: { title: 'Eliminar Tarjeta', deleted: MSG_TARJETA_ELIMINADA, remove: 'eliminarTarjeta' },
} as const

const ELIMINAR_FRACCIONAMIENTO = { eliminarTelefono, eliminarTarjeta }

export function AccesoItem({
  kind,
  domicilioId,
  id,
  valor,
  descripcion = null,
  estado,
  puedeReintentar = true,
  acciones,
}: {
  kind: AccesoKind
  domicilioId: number
  id: number
  valor: string
  /** Solo tarjetas. */
  descripcion?: string | null
  /** Estado de sincronización (solo tarjetas); sin tarea no se muestra. */
  estado?: EstadoEntidad
  puedeReintentar?: boolean
  acciones?: AccionesAccesos
}) {
  const router = useRouter()
  const config = KINDS[kind]

  async function onConfirm() {
    const result = await (acciones ?? ELIMINAR_FRACCIONAMIENTO)[config.remove](id, domicilioId)
    if (!result.ok) throw new Error(result.error)
    toast.success(config.deleted)
    router.refresh()
  }

  const editar = (
    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${valor}`}>
      <Pencil />
    </Button>
  )

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {kind === 'telefono' ? (
          <Phone className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <CreditCard className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium tabular-nums">{valor}</span>
          {descripcion ? <span className="truncate text-xs text-muted-foreground">{descripcion}</span> : null}
        </div>
        {kind === 'tarjeta' ? (
          <SyncEstado estado={estado} reintentar={acciones?.reintentarTarea} puedeReintentar={puedeReintentar} />
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        {kind === 'telefono' ? (
          <NumeroDialog domicilioId={domicilioId} item={{ id, valor }} acciones={acciones} trigger={editar} />
        ) : (
          <TarjetaDialog
            domicilioId={domicilioId}
            item={{ id, numero: valor, descripcion }}
            acciones={acciones}
            trigger={editar}
          />
        )}
        <ConfirmDialog
          title={config.title}
          description="¿Deseas eliminar este registro? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={onConfirm}
          trigger={
            <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`Eliminar ${valor}`}>
              <Trash2 />
            </Button>
          }
        />
      </div>
    </li>
  )
}
