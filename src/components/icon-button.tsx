import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

const TONO = {
  default: 'text-brand-navy hover:bg-muted',
  danger: 'text-danger-foreground hover:bg-danger-light',
} as const

/**
 * Botón cuadrado con borde y solo ícono. `label` es el nombre accesible y el título.
 * React 19 pasa `ref` como prop, así que sirve de disparador de Radix (con `asChild`).
 */
export function IconButton({
  icon: Icon,
  label,
  tono = 'default',
  asChild = false,
  className,
  children,
  type,
  ...props
}: Omit<ComponentProps<'button'>, 'aria-label' | 'title'> & {
  icon: LucideIcon
  label: string
  tono?: keyof typeof TONO
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="icon-button"
      data-tono={tono}
      type={asChild ? type : (type ?? 'button')}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none',
        TONO[tono],
        className,
      )}
      {...props}
    >
      {asChild ? children : <Icon className="size-4" aria-hidden="true" />}
    </Comp>
  )
}
