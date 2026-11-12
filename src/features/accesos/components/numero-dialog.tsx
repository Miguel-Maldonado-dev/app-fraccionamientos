'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/action-result'
import { actualizarTelefono, crearTelefono } from '../actions'
import { MSG_TELEFONO_GUARDADO } from '../messages'
import { numeroSchema, type NumeroInput } from '../schemas'
import type { AccionesAccesos } from './acciones'

const FORM_ID = 'numero-form'

type AccionesNumero = Pick<AccionesAccesos, 'crearTelefono' | 'actualizarTelefono'>

const ACCIONES_FRACCIONAMIENTO: AccionesNumero = { crearTelefono, actualizarTelefono }

/** Alta y edición de un número de teléfono con acceso. Las tarjetas usan `TarjetaDialog`. */
export function NumeroDialog({
  domicilioId,
  item,
  trigger,
  acciones = ACCIONES_FRACCIONAMIENTO,
}: {
  domicilioId: number
  item?: { id: number; valor: string }
  trigger: ReactNode
  acciones?: AccionesNumero
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NumeroInput>({
    resolver: zodResolver(numeroSchema),
    defaultValues: { valor: item?.valor ?? '' },
  })

  async function onSubmit({ valor }: NumeroInput) {
    const result: ActionResult = item
      ? await acciones.actualizarTelefono(item.id, domicilioId, valor)
      : await acciones.crearTelefono(domicilioId, valor)
    if (result.ok) {
      toast.success(MSG_TELEFONO_GUARDADO)
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) reset({ valor: item?.valor ?? '' })
    setOpen(next)
  }

  return (
    <FormDialog
      title={item ? 'Editar Número' : 'Agregar Número'}
      description={
        item
          ? 'Actualiza el número de teléfono con acceso al fraccionamiento.'
          : 'Agrega un número de teléfono con acceso al fraccionamiento.'
      }
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
      <form
        id={FORM_ID}
        onSubmit={handleSubmit(onSubmit, () => toast.error('Por favor, ingresa todos los datos obligatorios. (*)'))}
        className="grid gap-4"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="valor" className="text-xs font-medium">
            Número de teléfono <span className="text-danger-foreground">*</span>
          </Label>
          <Input id="valor" inputMode="numeric" maxLength={10} {...register('valor')} />
          {errors.valor && <p className="text-xs text-danger-foreground">{errors.valor.message}</p>}
        </div>
      </form>
    </FormDialog>
  )
}
