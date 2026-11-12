'use client'

import { KeyRound, RefreshCw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormDialog } from '@/components/form-dialog'
import { SectionCard } from '@/components/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/action-result'
import { fijarPinDomicilio, generarPinDomicilio, quitarPinDomicilio } from '../actions'
import { MSG_PIN_GESTIONADO, MSG_PIN_GUARDADO, MSG_PIN_QUITADO, MSG_PIN_SIN_SINCRONIZAR } from '../messages'
import { pinSchema } from '../schemas'

export type AccionesPin = {
  fijarPin: (domicilioId: number, pin: string) => Promise<ActionResult>
  generarPin: (domicilioId: number) => Promise<ActionResult<{ pin: string }>>
  quitarPin: (domicilioId: number) => Promise<ActionResult>
}

const ACCIONES_FRACCIONAMIENTO: AccionesPin = {
  fijarPin: fijarPinDomicilio,
  generarPin: generarPinDomicilio,
  quitarPin: quitarPinDomicilio,
}

/**
 * PIN del domicilio. Las acciones llaman a access-core en el momento (sin cola).
 * `pin`: el PIN guardado, `null` = sin PIN, `undefined` = el rol no puede verlo (comité y vigilancia):
 * entonces solo se indica que lo gestiona la administración, sin estado ni acciones.
 */
export function PinCard({
  domicilioId,
  pin,
  sincronizado,
  acciones = ACCIONES_FRACCIONAMIENTO,
}: {
  domicilioId: number
  pin: string | null | undefined
  /** El domicilio ya existe en access-core (`titular_id`); sin él no se puede gestionar el PIN. */
  sincronizado: boolean
  acciones?: AccionesPin
}) {
  const router = useRouter()
  const [generando, setGenerando] = useState(false)
  const [generado, setGenerado] = useState<string | null>(null)

  if (pin === undefined) {
    return (
      <SectionCard title="PIN" icon={KeyRound}>
        <p className="text-sm text-muted-foreground">{MSG_PIN_GESTIONADO}</p>
      </SectionCard>
    )
  }

  async function onGenerar() {
    setGenerando(true)
    try {
      const result = await acciones.generarPin(domicilioId)
      if (result.ok) {
        setGenerado(result.data.pin)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setGenerando(false)
    }
  }

  async function onQuitar() {
    const result = await acciones.quitarPin(domicilioId)
    if (!result.ok) throw new Error(result.error)
    toast.success(MSG_PIN_QUITADO)
    router.refresh()
  }

  const bloqueado = !sincronizado

  return (
    <SectionCard
      title="PIN"
      description="De 4 a 6 dígitos"
      icon={KeyRound}
      action={
        <div className="flex flex-wrap gap-2">
          <FijarPinDialog domicilioId={domicilioId} disabled={bloqueado} fijarPin={acciones.fijarPin} />
          {pin ? (
            <ConfirmDialog
              title="Generar PIN"
              description="Se reemplazará el PIN actual del domicilio."
              confirmLabel="Generar"
              tone="default"
              onConfirm={onGenerar}
              trigger={
                <Button size="sm" variant="secondary" disabled={bloqueado} loading={generando}>
                  <RefreshCw />
                  Generar
                </Button>
              }
            />
          ) : (
            <Button size="sm" variant="secondary" disabled={bloqueado} loading={generando} onClick={onGenerar}>
              <RefreshCw />
              Generar
            </Button>
          )}
        </div>
      }
    >
      {bloqueado && <p className="mb-3 text-xs text-muted-foreground">{MSG_PIN_SIN_SINCRONIZAR}</p>}
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-3">
          {pin ? <span className="font-mono text-lg font-semibold tracking-widest tabular-nums">{pin}</span> : null}
          <Badge variant={pin ? 'success' : 'neutral'}>{pin ? 'Asignado' : 'Sin PIN'}</Badge>
        </div>
        {pin ? (
          <ConfirmDialog
            title="Quitar PIN"
            description="El PIN dejará de abrir el acceso de este domicilio. ¿Deseas quitarlo?"
            confirmLabel="Quitar"
            onConfirm={onQuitar}
            trigger={
              <Button variant="ghost" size="sm" className="text-danger" disabled={bloqueado}>
                <Trash2 />
                Quitar
              </Button>
            }
          />
        ) : null}
      </div>
      <FormDialog
        title="PIN generado"
        description="Entrega este PIN al residente: lo usará en el teclado del acceso."
        open={generado !== null}
        onOpenChange={(abierto) => !abierto && setGenerado(null)}
        size="sm"
        footer={<Button onClick={() => setGenerado(null)}>Cerrar</Button>}
      >
        <p className="text-center font-mono text-3xl font-semibold tracking-[0.3em] tabular-nums">{generado}</p>
      </FormDialog>
    </SectionCard>
  )
}

function FijarPinDialog({
  domicilioId,
  disabled,
  fijarPin,
}: {
  domicilioId: number
  disabled: boolean
  fijarPin: AccionesPin['fijarPin']
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [valor, setValor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) {
      setValor('')
      setError(null)
    }
    setOpen(next)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = pinSchema.safeParse(valor)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const result = await fijarPin(domicilioId, parsed.data)
      if (result.ok) {
        toast.success(MSG_PIN_GUARDADO)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <FormDialog
      title="Fijar PIN"
      description="Captura el PIN que usará el domicilio en el teclado del acceso."
      size="sm"
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button size="sm" disabled={disabled}>
          <KeyRound />
          Fijar
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" type="button" disabled={guardando} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="pin-form" loading={guardando}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="pin-form" onSubmit={onSubmit} className="grid gap-1.5" noValidate>
        <Label htmlFor="pin" className="text-xs font-medium">
          PIN (4 a 6 dígitos) <span className="text-danger-foreground">*</span>
        </Label>
        <Input
          id="pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        {error && <p className="text-xs text-danger-foreground">{error}</p>}
      </form>
    </FormDialog>
  )
}
