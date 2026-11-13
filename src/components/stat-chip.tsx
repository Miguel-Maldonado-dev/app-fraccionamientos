import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONO = {
  neutral: { box: 'border border-border bg-card', icon: 'text-brand-primary' },
  success: { box: 'bg-success-light', icon: 'text-success-foreground' },
  info: { box: 'bg-muted', icon: 'text-muted-foreground' },
} as const

/** Indicador compacto para el encabezado de una tarjeta: ícono, valor y etiqueta. */
export function StatChip({
  icon: Icon,
  valor,
  etiqueta,
  tono = 'neutral',
}: {
  icon: LucideIcon
  valor: ReactNode
  etiqueta: string
  tono?: keyof typeof TONO
}) {
  const t = TONO[tono]
  return (
    <div data-slot="stat-chip" data-tono={tono} className={cn('flex items-center gap-3 rounded-xl px-4 py-2', t.box)}>
      <Icon className={cn('size-6 shrink-0', t.icon)} aria-hidden="true" />
      <div className="flex flex-col leading-tight">
        <span className="font-heading text-lg font-semibold text-brand-navy">{valor}</span>
        <span className="text-xs text-muted-foreground">{etiqueta}</span>
      </div>
    </div>
  )
}
