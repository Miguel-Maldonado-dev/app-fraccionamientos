'use client'

import { createContext, use, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormDialog } from '@/components/form-dialog'
import { Money } from '@/components/money'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cancelarCuotas, reactivarCuota } from '../cancelacion-actions'
import { MSG_CUOTA_REACTIVADA, msgCuotasCanceladas } from '../messages'

export const AVISO_CANCELACION =
  'Las cuotas canceladas no se cobrarán ni contarán para la morosidad. Puedes reactivarlas después.'

const MSG_ERROR_GENERICO = 'Ocurrió un error inesperado. Intenta de nuevo.'

export type CuotaCancelable = {
  id: number
  periodo: string | null
  concepto: string | null
  importe: number | null
}

type Seleccion = {
  seleccion: Set<number>
  alternar: (id: number, marcada: boolean) => void
  limpiar: () => void
}

const SeleccionContext = createContext<Seleccion | null>(null)

function useSeleccion(): Seleccion {
  const ctx = use(SeleccionContext)
  if (!ctx) throw new Error('Falta SeleccionCuotasProvider')
  return ctx
}

/** Estado de selección compartido entre las casillas de las filas y el botón de la tarjeta. */
export function SeleccionCuotasProvider({ children }: { children: ReactNode }) {
  const [seleccion, setSeleccion] = useState<Set<number>>(() => new Set())
  const alternar = (id: number, marcada: boolean) =>
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (marcada) next.add(id)
      else next.delete(id)
      return next
    })
  const limpiar = () => setSeleccion(new Set())
  return <SeleccionContext value={{ seleccion, alternar, limpiar }}>{children}</SeleccionContext>
}

export function CuotaCheckbox({ cuotaId, label }: { cuotaId: number; label: string }) {
  const { seleccion, alternar } = useSeleccion()
  return (
    <Checkbox
      aria-label={label}
      checked={seleccion.has(cuotaId)}
      onCheckedChange={(v) => alternar(cuotaId, v === true)}
    />
  )
}

export function CancelarCuotasDialog({ domicilioId, cuotas }: { domicilioId: number; cuotas: CuotaCancelable[] }) {
  const router = useRouter()
  const { seleccion, limpiar } = useSeleccion()
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const seleccionadas = cuotas.filter((c) => seleccion.has(c.id))
  const total = seleccionadas.reduce((acc, c) => acc + (c.importe ?? 0), 0)
  const motivoValido = motivo.trim().length >= 3 && motivo.trim().length <= 500

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setMotivo('')
  }

  async function confirmar() {
    setSubmitting(true)
    try {
      const result = await cancelarCuotas(
        domicilioId,
        seleccionadas.map((c) => c.id),
        motivo.trim(),
      )
      if (result.ok) {
        toast.success(msgCuotasCanceladas(result.data.canceladas))
        limpiar()
        handleOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error(MSG_ERROR_GENERICO)
    } finally {
      setSubmitting(false)
    }
  }

  // El botón solo aparece con al menos una cuota cancelable seleccionada.
  if (seleccionadas.length === 0 && !open) return null

  return (
    <FormDialog
      title="Cancelar cuotas"
      description={AVISO_CANCELACION}
      open={open}
      onOpenChange={handleOpenChange}
      size="sm"
      trigger={
        <Button variant="secondary" size="sm">
          <Ban aria-hidden="true" />
          Cancelar cuotas ({seleccionadas.length})
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" type="button" disabled={submitting} onClick={() => handleOpenChange(false)}>
            Volver
          </Button>
          <Button variant="destructive" loading={submitting} disabled={!motivoValido} onClick={confirmar}>
            Cancelar cuotas
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {seleccionadas.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span>
              <span className="font-medium">{c.periodo ?? '—'}</span>
              <span className="text-muted-foreground"> · {c.concepto}</span>
            </span>
            <Money value={c.importe} />
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 bg-muted/50 px-3 py-2 font-semibold">
          <span>Total</span>
          <Money value={total} />
        </li>
      </ul>
      <div className="mt-4 grid gap-2">
        <Label htmlFor="motivo-cancelacion">Motivo</Label>
        <Textarea
          id="motivo-cancelacion"
          value={motivo}
          maxLength={500}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Convenio con la administración"
        />
        <p className="text-xs text-muted-foreground">Obligatorio, de 3 a 500 caracteres.</p>
      </div>
    </FormDialog>
  )
}

/** "Reactivar (N)": solo aparece con al menos una cuota cancelada seleccionada. */
export function ReactivarCuotasButton({ domicilioId, cuotaIds }: { domicilioId: number; cuotaIds: number[] }) {
  const router = useRouter()
  const { seleccion, limpiar } = useSeleccion()
  const seleccionadas = cuotaIds.filter((id) => seleccion.has(id))
  if (seleccionadas.length === 0) return null
  const n = seleccionadas.length
  return (
    <ConfirmDialog
      title={n === 1 ? 'Reactivar cuota' : `Reactivar ${n} cuotas`}
      description="Las cuotas volverán a cobrarse y contarán para la morosidad según su vencimiento."
      confirmLabel="Reactivar"
      tone="default"
      trigger={
        <Button variant="secondary" size="sm">
          <RotateCcw aria-hidden="true" />
          Reactivar ({n})
        </Button>
      }
      onConfirm={async () => {
        for (const id of seleccionadas) {
          const result = await reactivarCuota(domicilioId, id)
          if (!result.ok) {
            router.refresh()
            throw new Error(result.error)
          }
        }
        toast.success(n === 1 ? MSG_CUOTA_REACTIVADA : `${n} cuotas reactivadas`)
        limpiar()
        router.refresh()
      }}
    />
  )
}
