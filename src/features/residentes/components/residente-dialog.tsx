'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/action-result'
import type { Tables } from '@/lib/supabase/types'
import { actualizarResidente, crearResidente } from '../actions'
import {
  MSG_CUENTA_VINCULADA,
  MSG_RESIDENTE_ACTUALIZADO,
  MSG_RESIDENTE_AGREGADO,
  MSG_TELEFONO_INVALIDO,
} from '../messages'
import { z } from 'zod'
import { residenteSchema } from '../schemas'
import { normalizarTelefono } from '../telefono'
import type { AccionesResidentes } from './acciones'

const FORM_ID = 'residente-form'

// El esquema del residente descarta claves desconocidas: se extiende para conservar las del acceso.
const camposSchema = residenteSchema.extend({ darAcceso: z.boolean().optional(), password: z.string().optional() })
type Campos = z.input<typeof camposSchema>

const ACCIONES_FRACCIONAMIENTO: Pick<AccionesResidentes, 'crear' | 'actualizar'> = {
  crear: crearResidente,
  actualizar: actualizarResidente,
}

export function ResidenteDialog({
  domicilioId,
  residente,
  trigger,
  acciones = ACCIONES_FRACCIONAMIENTO,
  accesoApp = false,
}: {
  domicilioId: number
  residente?: Tables<'residentes'>
  trigger: ReactNode
  acciones?: Pick<AccionesResidentes, 'crear' | 'actualizar'>
  /** Muestra, al agregar, la casilla para dar acceso a la app (solo el fraccionamiento, no la consola). */
  accesoApp?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const initial: Campos = {
    nombre: residente?.nombre ?? '',
    telefono: residente?.telefono ?? '',
    esPrincipal: residente?.es_principal ?? false,
    darAcceso: false,
    password: '',
  }
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Campos>({ resolver: zodResolver(camposSchema), defaultValues: initial })

  const darAcceso = useWatch({ control, name: 'darAcceso' }) === true
  const mostrarAcceso = accesoApp && !residente

  async function onSubmit({ darAcceso: dar, password, ...values }: Campos) {
    const conAcceso = mostrarAcceso && dar === true
    if (conAcceso && normalizarTelefono(values.telefono ?? '') === null) {
      toast.error(MSG_TELEFONO_INVALIDO)
      return
    }
    const result: ActionResult<{ cuentaCreada?: boolean } | void> = residente
      ? await acciones.actualizar(residente.id, domicilioId, values)
      : await acciones.crear(
          domicilioId,
          conAcceso ? { ...values, darAcceso: true, password: password || undefined } : values,
        )
    if (result.ok) {
      const vinculada = conAcceso && result.data?.cuentaCreada === false
      toast.success(vinculada ? MSG_CUENTA_VINCULADA : residente ? MSG_RESIDENTE_ACTUALIZADO : MSG_RESIDENTE_AGREGADO)
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) reset(initial)
    setOpen(next)
  }

  return (
    <FormDialog
      title={residente ? 'Editar Residente' : 'Agregar Residente'}
      description={residente ? 'Actualiza los datos del residente.' : 'Registra un residente en este domicilio.'}
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
          <Label htmlFor="nombre" className="text-xs font-medium">
            Nombre <span className="text-danger-foreground">*</span>
          </Label>
          <Input id="nombre" {...register('nombre')} />
          {errors.nombre && <p className="text-xs text-danger-foreground">{errors.nombre.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telefono" className="text-xs font-medium">
            Teléfono
          </Label>
          <Input id="telefono" inputMode="numeric" maxLength={10} {...register('telefono')} />
          {errors.telefono && <p className="text-xs text-danger-foreground">{errors.telefono.message}</p>}
        </div>
        {residente && (
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="esPrincipal"
              render={({ field }) => (
                <Checkbox
                  id="esPrincipal"
                  checked={field.value ?? false}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              )}
            />
            <Label htmlFor="esPrincipal">Residente Principal</Label>
          </div>
        )}
        {mostrarAcceso && (
          <>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="darAcceso"
                render={({ field }) => (
                  <Checkbox
                    id="darAcceso"
                    checked={field.value ?? false}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                )}
              />
              <Label htmlFor="darAcceso">Dar acceso a la app</Label>
            </div>
            {darAcceso && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-xs font-medium">
                  Contraseña
                </Label>
                <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
                <p className="text-xs text-secondary-foreground">
                  Mínimo 8 caracteres. Si el teléfono ya tiene cuenta, se vincula y esta contraseña se ignora.
                </p>
              </div>
            )}
          </>
        )}
      </form>
    </FormDialog>
  )
}
