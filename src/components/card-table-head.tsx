import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// Sin 'use client': los Server Components pasan íconos (componentes) a estas piezas, y eso solo se
// permite si no son componentes de cliente.

/** Fila de encabezado para tablas dentro de tarjetas: fondo `muted` con esquinas redondeadas. */
export const CARD_TABLE_HEAD_ROW =
  'border-0 bg-muted hover:bg-muted [&>th:first-child]:rounded-l-lg [&>th:last-child]:rounded-r-lg'

/** Celda de encabezado para tablas dentro de tarjetas, con ícono opcional antes del título. */
export function CardTableHead({
  icon: Icon,
  children,
  className,
  ...props
}: ComponentProps<typeof TableHead> & { icon?: LucideIcon }) {
  return (
    <TableHead className={cn('font-medium leading-none text-foreground', className)} {...props}>
      {Icon ? (
        // align-middle: sin él, el inline-flex se apoya en la línea base y deja más espacio abajo que arriba.
        <span className="inline-flex items-center gap-2 align-middle">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {children}
        </span>
      ) : (
        children
      )}
    </TableHead>
  )
}
