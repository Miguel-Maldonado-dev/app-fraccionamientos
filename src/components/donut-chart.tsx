import { formatPercent, percentOf } from '@/lib/percent'

type Color =
  | 'success'
  | 'danger'
  | 'info'
  | 'warning'
  | 'series-1'
  | 'series-2'
  | 'series-3'
  | 'series-4'
  | 'series-5'

const STROKE: Record<Color, string> = {
  success: 'stroke-success',
  danger: 'stroke-danger',
  info: 'stroke-info',
  warning: 'stroke-warning',
  'series-1': 'stroke-chart-1',
  'series-2': 'stroke-chart-2',
  'series-3': 'stroke-chart-3',
  'series-4': 'stroke-chart-4',
  'series-5': 'stroke-chart-5',
}
const DOT: Record<Color, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  info: 'bg-info',
  warning: 'bg-warning',
  'series-1': 'bg-chart-1',
  'series-2': 'bg-chart-2',
  'series-3': 'bg-chart-3',
  'series-4': 'bg-chart-4',
  'series-5': 'bg-chart-5',
}

const RADIUS = 68
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function DonutChart({
  segments,
  total,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: Color }[]
  total: number
  centerLabel: string
  centerValue: string
}) {
  const ariaLabel = segments
    .map((s) => `${s.label}: ${s.value} (${formatPercent(percentOf(s.value, total))})`)
    .join(', ')
  const arcs = segments.map((s, i) => {
    const length = total > 0 ? (s.value / total) * CIRCUMFERENCE : 0
    const offset = segments
      .slice(0, i)
      .reduce((sum, p) => sum + (total > 0 ? (p.value / total) * CIRCUMFERENCE : 0), 0)
    return { ...s, length, offset }
  })
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <div className="relative size-[180px] shrink-0">
        <svg viewBox="0 0 180 180" className="size-full -rotate-90" role="img" aria-label={ariaLabel}>
          <circle cx="90" cy="90" r={RADIUS} fill="none" strokeWidth={22} className="stroke-muted" />
          {arcs
            .filter((a) => a.length > 0)
            .map((a) => (
              <circle
                key={a.label}
                cx="90"
                cy="90"
                r={RADIUS}
                fill="none"
                strokeWidth={22}
                className={STROKE[a.color]}
                strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
                strokeDashoffset={-a.offset}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-semibold text-brand-navy tabular-nums">{centerValue}</span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 shrink-0 rounded-full ${DOT[s.color]}`} aria-hidden="true" />
            <span className="text-secondary-foreground">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatPercent(percentOf(s.value, total))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
