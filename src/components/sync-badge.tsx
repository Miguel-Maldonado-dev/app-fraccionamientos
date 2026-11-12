import { RotateCw } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { EstadoSync } from '@/features/sincronizacion/tipos'

const ESTADOS: Record<EstadoSync, { label: string; variant: BadgeVariant }> = {
  ok: { label: 'Sincronizado', variant: 'success' },
  pendiente: { label: 'Pendiente', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
}

/**
 * Estado de sincronización con access-core de un elemento (la última tarea de la cola).
 * `null` = aún no hay tarea: no se muestra nada. En error, el mensaje va como `title` del badge (y
 * oculto para lectores de pantalla) y, con `onReintentar`, un botón "Reintentar".
 */
export function SyncBadge({
  estado,
  error,
  onReintentar,
  reintentando = false,
}: {
  estado: EstadoSync | null
  error?: string | null
  onReintentar?: () => void
  reintentando?: boolean
}) {
  if (estado === null) return null
  const { label, variant } = ESTADOS[estado]
  const mensaje = estado === 'error' && error ? error : undefined
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={variant} dot title={mensaje}>
        <span>{label}</span>
        {mensaje ? <span className="sr-only">{mensaje}</span> : null}
      </Badge>
      {estado === 'error' && onReintentar ? (
        <Button variant="ghost" size="sm" onClick={onReintentar} loading={reintentando}>
          <RotateCw />
          Reintentar
        </Button>
      ) : null}
    </span>
  )
}
