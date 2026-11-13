'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionResult } from '@/lib/action-result'
import { cn } from '@/lib/utils'
import { MSG_SIN_INSTALACION } from '../messages'
import { botonSchema, ESTILOS, ICONOS, type BotonApp, type BotonInput, type SalidaApp } from '../schemas'
import { ESTILO_INFO } from '../estilos'
import { ICONO_INFO } from './iconos'
import { VistaTelefono } from './vista-telefono'

const FORM_ID = 'app-boton-form'
const SIN_SALIDA = '__sin_salida__'

const valoresDe = (b?: BotonApp | null) => ({
  nombre: b?.nombre ?? '',
  icono: b?.icono ?? 'puerta',
  estilo: b?.estilo ?? 'azul_claro',
  anchoCompleto: b?.ancho_completo ?? false,
  salidaId: b?.salida_id ?? null,
}) satisfies BotonInput

export function BotonForm({
  open,
  onOpenChange,
  boton,
  botones,
  salidas,
  tieneInstalacion,
  guardar,
  onGuardado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Botón a editar; `null` para uno nuevo. */
  boton: BotonApp | null
  /** Botones actuales, para mostrar el borrador en su lugar dentro del teléfono. */
  botones: BotonApp[]
  /** Salidas de la instalación; `null` si access-core no respondió. */
  salidas: SalidaApp[] | null
  tieneInstalacion: boolean
  guardar: (input: BotonInput & { id?: number }) => Promise<ActionResult>
  onGuardado: () => void
}) {
  const [valores, setValores] = useState<BotonInput>(() => valoresDe(boton))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Una salida guardada que ya no figura en la instalación se conserva como opción.
  const opciones = [...(salidas ?? [])]
  if (boton?.salida_id && !opciones.some((s) => s.id === boton.salida_id)) {
    opciones.push({
      id: boton.salida_id,
      alias: boton.salida_nombre ?? 'Salida guardada',
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = botonSchema.safeParse(valores)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setGuardando(true)
    try {
      const r = await guardar(boton ? { ...parsed.data, id: boton.id } : parsed.data)
      if (r.ok) {
        toast.success(boton ? 'Botón actualizado' : 'Botón agregado')
        onOpenChange(false)
        onGuardado()
      } else {
        toast.error(r.error)
      }
    } finally {
      setGuardando(false)
    }
  }

  const BORRADOR = 'borrador'
  const borrador = {
    id: boton?.id ?? BORRADOR,
    nombre: valores.nombre.trim() || 'Nombre del botón',
    icono: valores.icono,
    estilo: valores.estilo,
    ancho_completo: valores.anchoCompleto,
    salida_id: valores.salidaId,
  }
  const vistaPrevia = boton ? botones.map((b) => (b.id === boton.id ? borrador : b)) : [...botones, borrador]

  return (
    <FormDialog
      size="lg"
      title={boton ? 'Editar botón' : 'Nuevo botón'}
      description="Así lo verán los residentes en la pantalla de inicio de la app."
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <>
          <Button variant="secondary" type="button" disabled={guardando} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={guardando}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <form id={FORM_ID} onSubmit={onSubmit} className="grid content-start gap-5" noValidate>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="boton-nombre" className="text-xs font-medium">
                Nombre <span className="text-danger-foreground">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">{valores.nombre.length}/30</span>
            </div>
            <Input
              id="boton-nombre"
              maxLength={30}
              placeholder="Ej. Pluma principal"
              value={valores.nombre}
              aria-invalid={Boolean(error)}
              onChange={(e) => {
                setValores((v) => ({ ...v, nombre: e.target.value }))
                setError(null)
              }}
            />
            {error && <p className="text-xs text-danger-foreground">{error}</p>}
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium">Ícono</legend>
            <div role="radiogroup" aria-label="Ícono" className="grid grid-cols-4 gap-2">
              {ICONOS.map((ic) => {
                const { Icon, etiqueta } = ICONO_INFO[ic]
                const activo = valores.icono === ic
                return (
                  <button
                    key={ic}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => setValores((v) => ({ ...v, icono: ic }))}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      activo
                        ? 'border-primary bg-primary-light font-semibold text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {etiqueta}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium">Estilo</legend>
            <div role="radiogroup" aria-label="Estilo" className="grid grid-cols-4 gap-2">
              {ESTILOS.map((es) => {
                const info = ESTILO_INFO[es]
                const activo = valores.estilo === es
                return (
                  <button
                    key={es}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    aria-label={info.etiqueta}
                    onClick={() => setValores((v) => ({ ...v, estilo: es }))}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      activo ? 'border-primary font-semibold text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-8 w-full rounded-md border border-black/5"
                      style={{
                        background: info.degradado
                          ? `linear-gradient(135deg, ${info.degradado[0]}, ${info.degradado[1]})`
                          : info.fondo,
                      }}
                    />
                    {info.etiqueta}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="boton-salida" className="text-xs font-medium">
              Salida que abre
            </Label>
            {!tieneInstalacion ? (
              <p className="flex items-center gap-2 rounded-md bg-warning-light px-3 py-2 text-sm text-warning-foreground">
                <AlertTriangle className="size-4 shrink-0" aria-hidden /> {MSG_SIN_INSTALACION}
              </p>
            ) : (
              <>
                <Select
                  value={valores.salidaId ?? SIN_SALIDA}
                  disabled={salidas === null}
                  onValueChange={(v) =>
                    setValores((x) => ({
                      ...x,
                      salidaId: v === SIN_SALIDA ? null : v,
                    }))
                  }
                >
                  <SelectTrigger id="boton-salida" className="w-full" aria-label="Salida que abre">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_SALIDA}>Sin salida (se verá deshabilitado)</SelectItem>
                    {opciones.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.alias}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {salidas === null && <p className="text-xs text-danger-foreground">No se pudo consultar access-core</p>}
              </>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="boton-ancho"
              checked={valores.anchoCompleto}
              onCheckedChange={(v) => setValores((x) => ({ ...x, anchoCompleto: v === true }))}
            />
            <div className="grid gap-0.5">
              <Label htmlFor="boton-ancho" className="text-sm">
                Ancho completo
              </Label>
              <p className="text-xs text-muted-foreground">Ocupa toda la fila en lugar de media.</p>
            </div>
          </div>
        </form>
        <div className="hidden sm:block">
          <VistaTelefono botones={vistaPrevia} resaltado={borrador.id} compacto />
        </div>
      </div>
    </FormDialog>
  )
}
