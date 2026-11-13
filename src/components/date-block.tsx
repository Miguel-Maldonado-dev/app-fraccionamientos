const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** Bloque de fecha: día y mes abreviado en mayúsculas. `fecha` en formato AAAA-MM-DD. */
export function DateBlock({ fecha }: { fecha: string }) {
  const [, mes, dia] = (fecha ?? '').slice(0, 10).split('-').map(Number)
  const valido = Number.isInteger(mes) && Number.isInteger(dia) && mes >= 1 && mes <= 12 && dia >= 1
  if (!valido) {
    return (
      <div
        data-slot="date-block"
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        —
      </div>
    )
  }
  return (
    <div
      data-slot="date-block"
      className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted leading-none"
    >
      <span className="font-heading text-lg font-semibold text-brand-navy">{dia}</span>
      <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">{MESES[mes - 1]}</span>
    </div>
  )
}
