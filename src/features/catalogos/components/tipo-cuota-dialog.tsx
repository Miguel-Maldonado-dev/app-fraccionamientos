'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionResult } from '@/lib/action-result'
import { MEDIO_LABEL, MEDIOS_HABILITABLES, type MedioAcceso } from '@/lib/constants'
import { guardarTipoCuota } from '../actions'
import type { PerfilOpcion } from '../access-core'
import { CATALOGOS, type TipoCuota } from '../catalogos'
import { AVISO_IMPORTE, AVISO_NOMBRE } from '../messages'
import { tipoCuotaSchema, type TipoCuotaInput, type TipoCuotaOutput } from '../schemas'
import { CamposCatalogo } from './campos-catalogo'

const FORM_ID = 'tipo-cuota-form'
const config = CATALOGOS.cuotas

/** Acción que guarda un tipo de cuota; por defecto la de Configuración, en la consola la del fraccionamiento. */
export type GuardarTipoCuota = (id: number | null, input: TipoCuotaInput) => Promise<ActionResult>

const SIN_PERMISO = '__sin_permiso__'
const MSG_SIN_MEDIOS = 'El super admin aún no habilita medios de acceso para este fraccionamiento'
const MSG_SIN_INSTALACION = 'Pide al super admin vincular la instalación de access-core'
const MSG_SIN_API = 'No se pudo consultar access-core'

const valoresDe = (item?: TipoCuota): TipoCuotaInput => ({
  nombre: item?.nombre ?? '',
  importe: item ? String(item.importe) : '',
  medios: item?.medios ?? [],
  perfilCorrienteId: item?.perfilCorrienteId ?? null,
  perfilCorrienteNombre: item?.perfilCorrienteNombre ?? null,
  perfilMorosoId: item?.perfilMorosoId ?? null,
  perfilMorosoNombre: item?.perfilMorosoNombre ?? null,
})

/** Marca o desmarca un medio y deja el arreglo en el orden del catálogo. */
const alternarMedio = (medios: MedioAcceso[], medio: MedioAcceso, activo: boolean): MedioAcceso[] =>
  MEDIOS_HABILITABLES.filter((m) => (m === medio ? activo : medios.includes(m)))

const PERMISOS = [
  { etiqueta: 'Permiso al corriente', id: 'perfilCorrienteId', nombre: 'perfilCorrienteNombre' },
  { etiqueta: 'Permiso moroso', id: 'perfilMorosoId', nombre: 'perfilMorosoNombre' },
] as const

function PermisoSelect({
  etiqueta,
  control,
  campoId,
  onChange,
  perfiles,
  deshabilitado,
  actualNombre,
}: {
  etiqueta: string
  control: Control<TipoCuotaInput, unknown, TipoCuotaOutput>
  campoId: 'perfilCorrienteId' | 'perfilMorosoId'
  onChange: (perfil: PerfilOpcion | null) => void
  perfiles: PerfilOpcion[] | null
  deshabilitado: boolean
  actualNombre: string | null
}) {
  const valor = useWatch({ control, name: campoId }) || null
  // Si el permiso guardado ya no existe en access-core se sigue mostrando con su nombre guardado.
  const opciones = [...(perfiles ?? [])]
  if (valor && !opciones.some((p) => p.id === valor)) opciones.push({ id: valor, nombre: actualNombre ?? valor })
  const htmlId = `${campoId}-select`
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlId}>{etiqueta}</Label>
      <Select
        value={valor ?? SIN_PERMISO}
        disabled={deshabilitado}
        onValueChange={(v) => onChange(opciones.find((p) => p.id === v) ?? null)}
      >
        <SelectTrigger id={htmlId} className="w-full">
          <SelectValue placeholder="Sin permiso" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_PERMISO}>Sin permiso</SelectItem>
          {opciones.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function TipoCuotaDialog({
  item,
  trigger,
  guardar = guardarTipoCuota,
  mediosHabilitados,
  perfiles,
  tieneInstalacion,
}: {
  item?: TipoCuota
  trigger: ReactNode
  guardar?: GuardarTipoCuota
  mediosHabilitados: MedioAcceso[]
  perfiles: PerfilOpcion[] | null
  tieneInstalacion: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const {
    register,
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(tipoCuotaSchema), defaultValues: valoresDe(item) })
  const [nombre, importe] = useWatch({ control, name: ['nombre', 'importe'] })
  const avisos: string[] = []
  if (item && Number(String(importe).trim()) !== item.importe) avisos.push(AVISO_IMPORTE)
  if (item && nombre.trim() !== item.nombre) avisos.push(AVISO_NOMBRE)

  async function onSubmit(values: TipoCuotaOutput) {
    // Un medio que el super admin ya quitó no se puede guardar (lo rechaza la base): se omite.
    const result = await guardar(item?.id ?? null, {
      ...values,
      medios: values.medios.filter((m) => mediosHabilitados.includes(m)),
    })
    if (result.ok) {
      toast.success(config.guardado)
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) reset(valoresDe(item))
    setOpen(next)
  }

  return (
    <FormDialog
      size="sm"
      title={`${item ? 'Editar' : 'Agregar'} ${config.singular}`}
      description={config.descripcion}
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
        <CamposCatalogo register={register} errors={errors} etiquetaMonto={config.etiquetaMonto} avisos={avisos} />
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-xs font-medium">Medios de acceso que incluye</legend>
          {mediosHabilitados.length === 0 ? (
            <p className="text-xs text-muted-foreground">{MSG_SIN_MEDIOS}</p>
          ) : (
            <Controller
              control={control}
              name="medios"
              render={({ field }) => (
                <>
                  {MEDIOS_HABILITABLES.filter((m) => mediosHabilitados.includes(m)).map((medio) => (
                    <div key={medio} className="flex items-center gap-2">
                      <Checkbox
                        id={`medio-${medio}`}
                        checked={field.value.includes(medio)}
                        onCheckedChange={(v) => field.onChange(alternarMedio(field.value, medio, v === true))}
                      />
                      <Label htmlFor={`medio-${medio}`}>{MEDIO_LABEL[medio]}</Label>
                    </div>
                  ))}
                </>
              )}
            />
          )}
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-xs font-medium">Permisos en access-core</legend>
          {PERMISOS.map(({ etiqueta, id, nombre }) => (
            <PermisoSelect
              key={id}
              etiqueta={etiqueta}
              control={control}
              campoId={id}
              onChange={(perfil) => {
                setValue(id, perfil?.id ?? null)
                setValue(nombre, perfil?.nombre ?? null)
              }}
              perfiles={perfiles}
              deshabilitado={!tieneInstalacion || perfiles === null}
              actualNombre={item?.[nombre] ?? null}
            />
          ))}
          {!tieneInstalacion ? (
            <p className="text-xs text-muted-foreground">{MSG_SIN_INSTALACION}</p>
          ) : perfiles === null ? (
            <p className="text-xs text-danger-foreground">{MSG_SIN_API}</p>
          ) : null}
        </fieldset>
      </form>
    </FormDialog>
  )
}
