'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { actualizarFraccionamiento, crearFraccionamiento } from '../actions'
import type { FraccionamientoResumen } from '../queries'
import { fraccionamientoSchema, type FraccionamientoInput } from '../schemas'
import { slugify } from '../slug'

const FORM_ID = 'fraccionamiento-form'
/** Radix no admite `value=""` en un item; este valor representa "Sin instalación". */
const SIN_INSTALACION = '__sin_instalacion__'

const valoresDe = (item?: FraccionamientoResumen): FraccionamientoInput => ({
  nombre: item?.nombre ?? '',
  slug: item?.slug ?? '',
  instalacionId: item?.instalacionId ?? '',
  instalacionNombre: item?.instalacionNombre ?? null,
  activo: item?.activo ?? true,
})

export type InstalacionOpcion = { id: string; nombre: string }

export function FraccionamientoDialog({
  item,
  trigger,
  instalaciones,
}: {
  item?: FraccionamientoResumen
  trigger: ReactNode
  /** Instalaciones libres de access-core; `null` si la API no respondió. */
  instalaciones: InstalacionOpcion[] | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Al editar, el slug ya existe y no se reescribe solo.
  const [slugManual, setSlugManual] = useState(Boolean(item))
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(fraccionamientoSchema), defaultValues: valoresDe(item) })

  // Al editar, la instalación vinculada sigue siendo elegible aunque ya no figure como libre.
  const opciones = [...(instalaciones ?? [])]
  if (item?.instalacionId && !opciones.some((o) => o.id === item.instalacionId)) {
    opciones.unshift({ id: item.instalacionId, nombre: item.instalacionNombre ?? item.instalacionId })
  }

  const nombreReg = register('nombre')
  const slugReg = register('slug')

  // La acción vuelve a validar el formulario crudo (instalacionId '' → null), no la salida del resolver.
  async function onSubmit() {
    const values = getValues()
    const result = item ? await actualizarFraccionamiento(item.id, values) : await crearFraccionamiento(values)
    if (result.ok) {
      toast.success(item ? 'Fraccionamiento actualizado' : 'Fraccionamiento creado')
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      reset(valoresDe(item))
      setSlugManual(Boolean(item))
    }
    setOpen(next)
  }

  return (
    <FormDialog
      size="sm"
      title={item ? 'Editar fraccionamiento' : 'Nuevo fraccionamiento'}
      description="Datos generales del fraccionamiento."
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
          <Label htmlFor="fracc-nombre" className="text-xs font-medium">
            Nombre <span className="text-danger-foreground">*</span>
          </Label>
          <Input
            id="fracc-nombre"
            maxLength={80}
            {...nombreReg}
            onChange={(e) => {
              void nombreReg.onChange(e)
              if (!slugManual) setValue('slug', slugify(e.target.value), { shouldValidate: false })
            }}
          />
          {errors.nombre && <p className="text-xs text-danger-foreground">{errors.nombre.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fracc-slug" className="text-xs font-medium">
            Slug <span className="text-danger-foreground">*</span>
          </Label>
          <Input
            id="fracc-slug"
            maxLength={60}
            {...slugReg}
            onChange={(e) => {
              setSlugManual(true)
              void slugReg.onChange(e)
            }}
          />
          {errors.slug && <p className="text-xs text-danger-foreground">{errors.slug.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fracc-instalacion" className="text-xs font-medium">
            Instalación de access-core
          </Label>
          <Controller
            control={control}
            name="instalacionId"
            render={({ field }) => (
              <Select
                value={field.value || SIN_INSTALACION}
                disabled={instalaciones === null}
                onValueChange={(v) => {
                  const elegida = opciones.find((o) => o.id === v)
                  field.onChange(elegida ? elegida.id : '')
                  setValue('instalacionNombre', elegida ? elegida.nombre : null)
                }}
              >
                <SelectTrigger id="fracc-instalacion" className="w-full">
                  <SelectValue placeholder="Sin instalación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_INSTALACION}>Sin instalación</SelectItem>
                  {opciones.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {instalaciones === null ? (
            <p className="text-xs text-danger-foreground">No se pudo consultar access-core</p>
          ) : (
            <p className="text-xs text-secondary-foreground">
              Solo aparecen las instalaciones que ningún fraccionamiento tiene vinculadas.
            </p>
          )}
          {errors.instalacionId && <p className="text-xs text-danger-foreground">{errors.instalacionId.message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="activo"
            render={({ field }) => (
              <Checkbox id="fracc-activo" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            )}
          />
          <Label htmlFor="fracc-activo">Activo</Label>
        </div>
      </form>
    </FormDialog>
  )
}
