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
import { actualizarTarjeta, crearTarjeta } from '../actions'
import { MSG_TARJETA_GUARDADA } from '../messages'
import { tarjetaSchema, type TarjetaInput } from '../schemas'
import type { AccionesAccesos } from './acciones'
import { CodigoTarjetaDesglose, DesgloseTarjeta } from './codigo-tarjeta-desglose'

const FORM_ID = 'tarjeta-form'

type AccionesTarjeta = Pick<AccionesAccesos, 'crearTarjeta' | 'actualizarTarjeta'>

const ACCIONES_FRACCIONAMIENTO: AccionesTarjeta = { crearTarjeta, actualizarTarjeta }

/**
 * Alta y edición de una tarjeta. Al crear se captura el número (32 bits) y una descripción opcional;
 * al editar el número solo se muestra (access-core no permite cambiar `card_code`).
 */
export function TarjetaDialog({
  domicilioId,
  item,
  trigger,
  acciones = ACCIONES_FRACCIONAMIENTO,
}: {
  domicilioId: number
  item?: { id: number; numero: string; descripcion: string | null }
  trigger: ReactNode
  acciones?: AccionesTarjeta
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const valoresIniciales = () => ({ numero: item?.numero ?? '', descripcion: item?.descripcion ?? '' })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TarjetaInput>({
    resolver: zodResolver(tarjetaSchema),
    defaultValues: valoresIniciales(),
  })

  async function onSubmit({ numero, descripcion }: TarjetaInput) {
    const result: ActionResult = item
      ? await acciones.actualizarTarjeta(item.id, domicilioId, descripcion ?? '')
      : await acciones.crearTarjeta(domicilioId, { numero, descripcion })
    if (result.ok) {
      toast.success(MSG_TARJETA_GUARDADA)
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
      title={item ? 'Editar Tarjeta' : 'Agregar Tarjeta'}
      description={
        item ? 'Actualiza la descripción de la tarjeta de acceso.' : 'Agrega una tarjeta con acceso al fraccionamiento.'
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
        {item ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium">Número de tarjeta</p>
            <p className="text-sm font-semibold tabular-nums">{item.numero}</p>
            <p className="text-xs text-muted-foreground">
              El número no se puede cambiar: para usar otro, elimina esta tarjeta y agrega una nueva.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="numero" className="text-xs font-medium">
              Número de tarjeta <span className="text-danger-foreground">*</span>
            </Label>
            <Input id="numero" inputMode="numeric" maxLength={10} {...register('numero')} />
            {errors.numero && <p className="text-xs text-danger-foreground">{errors.numero.message}</p>}
          </div>
        )}
        {item ? <DesgloseTarjeta valor={item.numero} /> : <CodigoTarjetaDesglose control={control} />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descripcion" className="text-xs font-medium">
            Descripción
          </Label>
          <Input id="descripcion" maxLength={60} {...register('descripcion')} />
          {errors.descripcion && <p className="text-xs text-danger-foreground">{errors.descripcion.message}</p>}
        </div>
      </form>
    </FormDialog>
  )
}
