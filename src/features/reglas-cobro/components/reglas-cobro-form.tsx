'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { LabeledSelect } from '@/components/labeled-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/action-result'
import { MSG_REGLAS_GUARDADAS } from '../messages'
import { reglasCobroSchema, type ReglasCobro, type ReglasCobroInput } from '../schemas'

export type ConceptoRecargo = { id: number; nombre: string; monto: number }

const dia = (n: number) => ((n - 1) % 31) + 1

/** Texto de ejemplo con las fechas que resultan de las reglas capturadas (mes de 31 días como referencia). */
export function ejemploReglas(r: Pick<ReglasCobro, 'diaGeneracion' | 'diaVencimiento' | 'diasGracia' | 'conceptoRecargoId'>): string {
  const { diaGeneracion, diaVencimiento, diasGracia, conceptoRecargoId } = r
  const mesVencido = diaGeneracion !== null && diaVencimiento !== null && diaVencimiento < diaGeneracion
  const partes: string[] = []
  if (diaVencimiento === null) {
    partes.push('Las cuotas vencen el último día del mes')
    if (conceptoRecargoId !== null) partes.push('el recargo se aplica el día siguiente')
    partes.push(
      diasGracia === 0
        ? 'el acceso cambia a moroso el día siguiente al vencimiento'
        : `el acceso cambia a moroso ${diasGracia + 1} días después del vencimiento`,
    )
  } else {
    partes.push(`Las cuotas vencen el día ${diaVencimiento}${mesVencido ? ' del mes siguiente' : ''}`)
    if (conceptoRecargoId !== null) partes.push(`el recargo se aplica el día ${dia(diaVencimiento + 1)}`)
    partes.push(`el acceso cambia a moroso el día ${dia(diaVencimiento + diasGracia + 1)}`)
  }
  return `${partes.join('; ')}.`
}

type Campos = { diaGeneracion: string; diaVencimiento: string; diasGracia: string; cuotasParaMoroso: string; conceptoRecargoId: string | null }

const aTexto = (n: number | null) => (n === null ? '' : String(n))
const aNumero = (s: string) => (s.trim() === '' ? null : Number(s))

function aReglas(c: Campos): ReglasCobroInput {
  return {
    diaGeneracion: aNumero(c.diaGeneracion),
    diaVencimiento: aNumero(c.diaVencimiento),
    // Vacío no es 0: se manda NaN para que el esquema lo rechace con su mensaje.
    diasGracia: aNumero(c.diasGracia) ?? Number.NaN,
    cuotasParaMoroso: aNumero(c.cuotasParaMoroso) ?? Number.NaN,
    conceptoRecargoId: c.conceptoRecargoId === null ? null : Number(c.conceptoRecargoId),
  }
}

/** Formulario de reglas de cobro; sin permiso de escritura (`soloLectura`) deshabilita todo. */
export function ReglasCobroForm({
  reglas,
  conceptos,
  guardar,
  soloLectura = false,
}: {
  reglas: ReglasCobro
  conceptos: ConceptoRecargo[]
  guardar: (input: ReglasCobroInput) => Promise<ActionResult>
  soloLectura?: boolean
}) {
  const router = useRouter()
  const [c, setC] = useState<Campos>({
    diaGeneracion: aTexto(reglas.diaGeneracion),
    diaVencimiento: aTexto(reglas.diaVencimiento),
    diasGracia: String(reglas.diasGracia),
    cuotasParaMoroso: String(reglas.cuotasParaMoroso),
    conceptoRecargoId: reglas.conceptoRecargoId === null ? null : String(reglas.conceptoRecargoId),
  })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const parsed = reglasCobroSchema.safeParse(aReglas(c))
  const mostrarConcepto = (id: number) => conceptos.find((x) => x.id === id)

  async function onGuardar() {
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const result = await guardar(parsed.data)
      if (result.ok) {
        toast.success(MSG_REGLAS_GUARDADAS)
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setGuardando(false)
    }
  }

  const campo = (id: keyof Omit<Campos, 'conceptoRecargoId'>, label: string, ayuda: string, min: number, max: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={`reglas-${id}`}>{label}</Label>
      <Input
        id={`reglas-${id}`}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={c[id]}
        disabled={soloLectura}
        onChange={(e) => setC((p) => ({ ...p, [id]: e.target.value }))}
      />
      <p className="text-xs text-secondary-foreground">{ayuda}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <fieldset disabled={soloLectura} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {campo('diaGeneracion', 'Día de generación automática', 'Del 1 al 28. Vacío = no generar solas.', 1, 28)}
        {campo('diaVencimiento', 'Día de vencimiento', 'Del 1 al 31. Vacío = último día del mes.', 1, 31)}
        {campo('diasGracia', 'Días de gracia', 'Del 0 al 60. Retrasan el cambio de acceso a moroso.', 0, 60)}
        {campo('cuotasParaMoroso', 'Cuotas vencidas para ser moroso', 'Del 1 al 12.', 1, 12)}
        <div className="sm:col-span-2">
          <LabeledSelect
            id="reglas-recargo"
            label="Recargo automático"
            value={c.conceptoRecargoId}
            onChange={(v) => setC((p) => ({ ...p, conceptoRecargoId: v }))}
            options={conceptos.map((x) => ({ value: String(x.id), label: `${x.nombre} ($${x.monto})` }))}
            allLabel="Ninguno"
          />
          {reglas.conceptoRecargoId !== null && !mostrarConcepto(reglas.conceptoRecargoId) && (
            <p className="mt-1 text-xs text-secondary-foreground">El concepto configurado ya no existe.</p>
          )}
        </div>
      </fieldset>
      {parsed.success && (
        <p className="rounded-md bg-muted p-3 text-sm" data-testid="ejemplo-reglas">
          {ejemploReglas(parsed.data)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!soloLectura && (
        <Button type="button" onClick={onGuardar} loading={guardando}>
          Guardar reglas
        </Button>
      )}
    </div>
  )
}
