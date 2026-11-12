import type { ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'

export function EmptyState({
  title = 'Sin información disponible',
  description = 'No hay información disponible para mostrar.',
  icon: Icon = Inbox,
  action,
}: {
  title?: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-light text-brand-primary">
        <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="font-heading text-xl font-semibold text-brand-navy">{title}</h3>
      <p className="max-w-sm text-sm text-secondary-foreground">{description}</p>
      {action}
    </div>
  )
}
