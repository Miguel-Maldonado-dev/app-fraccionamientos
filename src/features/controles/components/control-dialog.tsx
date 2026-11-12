'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/action-result'
import { actualizarControl, crearControl } from '../actions'
import { MSG_CONTROL_GUARDADO } from '../messages'
import { controlSchema, etiquetaBoton, type BotonGuardado, type ControlInput } from '../schemas'

const FORM_ID = 'control-form'

export type AccionesControl = {
  crearControl: (domicilioId: number, input: ControlInput) => Promise<ActionResult>
  actualizarControl: (id: number, domicilioId: number, input: ControlInput) => Promise<ActionResult>
}

const ACCIONES_FRACCIONAMIENTO: AccionesControl = { crearControl, actualizarControl }

/** Un código por botón (índice = botón 0..3); vacío = el control no usa ese botón. */
type Valores = { descripcion: string; codigos: string[] }

/**
 * Alta y edición de un control RF: descripción opcional y el código RF de cada botón que use. Solo
 * se ofrecen los botones con salida configurada en el fraccionamiento (`botonesConfigurados`).
 */
export function ControlDialog({
  domicilioId,
  botonesConfigurados,
  item,
  trigger,
  acciones = ACCIONES_FRACCIONAMIENTO,
}: {
  domicilioId: number
  botonesConfigurados: number[]
  item?: { id: number; descripcion: string | null; botones: BotonGuardado[] }
  trigger: ReactNode
  acciones?: AccionesControl
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Botones guardados cuya salida ya no está configurada: no se editan aquí y el servidor los conserva.
  const sinSalida = (item?.botones ?? []).filter((b) => !botonesConfigurados.includes(b.boton))
  const valoresIniciales = (): Valores => {
    const codigos = ['', '', '', '']
    for (const b of item?.botones ?? []) codigos[b.boton] = String(b.rf_code)
    return { descripcion: item?.descripcion ?? '', codigos }
  }
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({ defaultValues: valoresIniciales() })

  async function onSubmit({ descripcion, codigos }: Valores) {
    clearErrors()
    const botones = botonesConfigurados
      .filter((b) => (codigos[b] ?? '').trim() !== '')
      .map((b) => ({ boton: b, rfCode: codigos[b].trim() }))
    const input: ControlInput = { descripcion, botones }
    const parsed = controlSchema.safeParse(input)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [campo, i, sub] = issue.path
        if (campo === 'botones' && typeof i === 'number' && sub === 'rfCode') {
          setError(`codigos.${botones[i].boton}`, { message: issue.message })
        } else if (campo === 'descripcion') {
          setError('descripcion', { message: issue.message })
        } else {
          setError('root', { message: issue.message })
        }
      }
      return
    }
    const result = item
      ? await acciones.actualizarControl(item.id, domicilioId, input)
      : await acciones.crearControl(domicilioId, input)
    if (result.ok) {
      toast.success(MSG_CONTROL_GUARDADO)
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) reset(valoresIniciales())
    setOpen(next)
  }

  return (
    <FormDialog
      title={item ? 'Editar control' : 'Agregar control'}
      description="Captura el código RF de cada botón que usará el control (al menos uno)."
      trigger={trigger}
      open={open}
      onOpenChange={handleOpenChange}
      footer={
        <>
          <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="control-descripcion" className="text-xs font-medium">
            Descripción
          </Label>
          <Input id="control-descripcion" maxLength={60} {...register('descripcion')} />
          {errors.descripcion && <p className="text-xs text-danger-foreground">{errors.descripcion.message}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {botonesConfigurados.map((b) => (
            <div key={b} className="flex flex-col gap-1.5">
              <Label htmlFor={`control-boton-${b}`} className="text-xs font-medium">
                {etiquetaBoton(b)}
              </Label>
              <Input
                id={`control-boton-${b}`}
                inputMode="numeric"
                maxLength={10}
                placeholder="Código RF"
                {...register(`codigos.${b}`)}
              />
              {errors.codigos?.[b] && <p className="text-xs text-danger-foreground">{errors.codigos[b]?.message}</p>}
            </div>
          ))}
        </div>
        {sinSalida.length > 0 && (
          <div className="flex flex-col gap-1">
            {sinSalida.map((b) => (
              <p key={b.boton} className="text-xs text-muted-foreground tabular-nums">
                {`${etiquetaBoton(b.boton)} · sin salida configurada`}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">Se conservan sin cambios hasta que se configure su salida.</p>
          </div>
        )}
        {errors.root && <p className="text-xs text-danger-foreground">{errors.root.message}</p>}
      </form>
    </FormDialog>
  )
}
