import type { ReactNode } from 'react'

/** Píldora azul suave para periodos (p. ej. "Nov/2026"). */
export function PeriodoPill({ children }: { children: ReactNode }) {
  return (
    <span
      data-slot="periodo-pill"
      className="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-sm whitespace-nowrap text-brand-navy"
    >
      {children}
    </span>
  )
}
