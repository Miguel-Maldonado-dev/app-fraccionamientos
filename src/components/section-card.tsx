import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function SectionCard({
  title,
  description,
  icon: Icon,
  stats,
  action,
  children,
  className,
  flush = false,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  /** Indicadores (p. ej. `StatChip`) a la izquierda de `action`, separados por una línea vertical. */
  stats?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Cuerpo sin relleno, para tablas que van de borde a borde como en las demás pantallas. */
  flush?: boolean
}) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <div className={cn('flex justify-between gap-4 p-5', description ? 'items-start' : 'items-center')}>
        <div className={cn('flex gap-3', Icon ? 'items-center' : 'items-start')}>
          {Icon ? (
            <>
              <span
                data-slot="section-card-icon-tile"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10"
              >
                <Icon data-slot="section-card-icon" className="size-6 text-brand-primary" aria-hidden="true" />
              </span>
              <span aria-hidden="true" className="h-10 w-px shrink-0 bg-border" />
            </>
          ) : null}
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-xl font-semibold text-brand-navy">{title}</h3>
            {description ? <p className="text-sm text-secondary-foreground">{description}</p> : null}
          </div>
        </div>
        {stats ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            {stats ? (
              <div data-slot="section-card-stats" className="flex items-center gap-3">
                {stats}
              </div>
            ) : null}
            {stats && action ? <span aria-hidden="true" className="h-10 w-px bg-border" /> : null}
            {action}
          </div>
        ) : (
          action
        )}
      </div>
      <div data-slot="section-card-body" className={flush ? undefined : 'px-5 pb-5'}>
        {children}
      </div>
    </Card>
  )
}
