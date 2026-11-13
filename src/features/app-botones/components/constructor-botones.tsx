'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/action-result'
import { cn } from '@/lib/utils'
import { distribucion, MAX_BOTONES, type BotonApp, type BotonInput, type SalidaApp } from '../schemas'
import { BotonForm } from './boton-form'
import { ICONO_INFO } from './iconos'
import { VistaTelefono } from './vista-telefono'

export type AccionesBotones = {
  guardar: (input: BotonInput & { id?: number }) => Promise<ActionResult>
  eliminar: (id: number) => Promise<ActionResult>
  reordenar: (ids: number[]) => Promise<ActionResult>
}

export function ConstructorBotones({
  botones: iniciales,
  salidas,
  tieneInstalacion,
  acciones,
}: {
  botones: BotonApp[]
  salidas: SalidaApp[] | null
  tieneInstalacion: boolean
  acciones: AccionesBotones
}) {
  const router = useRouter()
  // Orden optimista: la lista y la vista previa se mueven al instante; si falla se regresa.
  const [orden, setOrden] = useState<{
    base: BotonApp[]
    ids: number[] | null
  }>({ base: iniciales, ids: null })
  const ids = orden.base === iniciales && orden.ids ? orden.ids : null
  const porId = new Map(iniciales.map((b) => [b.id, b]))
  const botones = ids ? ids.map((id) => porId.get(id)).filter((b): b is BotonApp => Boolean(b)) : iniciales

  const [form, setForm] = useState<{
    abierto: boolean
    boton: BotonApp | null
    n: number
  }>({
    abierto: false,
    boton: null,
    n: 0,
  })
  const [aBorrar, setABorrar] = useState<BotonApp | null>(null)
  const [enfoque, setEnfoque] = useState<number | null>(null)
  const [pendiente, startTransition] = useTransition()

  const lleno = botones.length >= MAX_BOTONES
  const lados = distribucion(botones)

  function abrir(boton: BotonApp | null) {
    setForm((f) => ({ abierto: true, boton, n: f.n + 1 }))
  }

  function aplicarOrden(nuevos: number[], enfocar?: number) {
    setOrden({ base: iniciales, ids: nuevos })
    if (enfocar !== undefined) setEnfoque(enfocar)
    startTransition(async () => {
      const r = await acciones.reordenar(nuevos)
      if (r.ok) {
        router.refresh()
      } else {
        toast.error(r.error)
        setOrden({ base: iniciales, ids: null })
      }
    })
  }

  function mover(i: number, delta: -1 | 1) {
    const actuales = botones.map((b) => b.id)
    const nuevos = reordenarIds(actuales, actuales[i], actuales[i + delta])
    if (nuevos) aplicarOrden(nuevos, actuales[i])
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const nuevos = reordenarIds(
      botones.map((b) => b.id),
      Number(active.id),
      over ? Number(over.id) : undefined,
    )
    if (nuevos) aplicarOrden(nuevos)
  }

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function confirmarBorrado() {
    if (!aBorrar) return
    const r = await acciones.eliminar(aBorrar.id)
    if (r.ok) {
      toast.success('Botón eliminado')
      router.refresh()
    } else {
      toast.error(r.error)
    }
    setABorrar(null)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Botones de la pantalla de inicio</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {botones.length} de {MAX_BOTONES}
            </p>
          </div>
          <Button size="sm" onClick={() => abrir(null)} disabled={lleno}>
            <Plus /> Agregar botón
          </Button>
        </div>

        {botones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <Smartphone className="size-8 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-sm font-medium">Aún no hay botones</p>
              <p className="text-xs text-muted-foreground">
                Agrega el primero (por ejemplo, la pluma de entrada) y míralo aparecer en el teléfono.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => abrir(null)}>
              <Plus /> Agregar botón
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensores}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={botones.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2" aria-label="Botones en orden">
                {botones.map((b, i) => (
                  <FilaBoton
                    key={b.id}
                    boton={b}
                    indice={i}
                    total={botones.length}
                    lado={lados[i]}
                    resaltado={enfoque === b.id}
                    pendiente={pendiente}
                    onEnfoque={setEnfoque}
                    onMover={(delta) => mover(i, delta)}
                    onEditar={() => abrir(b)}
                    onEliminar={() => setABorrar(b)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {lleno && (
          <p className="text-xs text-muted-foreground">Máximo {MAX_BOTONES} botones. Elimina uno para agregar otro.</p>
        )}
        {!tieneInstalacion && botones.length > 0 && (
          <p className="text-xs text-warning-foreground">
            Sin instalación ligada los botones se ven deshabilitados. Liga una instalación en la pestaña Accesos.
          </p>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <VistaTelefono botones={botones} resaltado={enfoque} />
      </div>

      <BotonForm
        key={form.n}
        open={form.abierto}
        onOpenChange={(abierto) => setForm((f) => ({ ...f, abierto }))}
        boton={form.boton}
        botones={botones}
        salidas={salidas}
        tieneInstalacion={tieneInstalacion}
        guardar={acciones.guardar}
        onGuardado={() => router.refresh()}
      />

      <AlertDialog open={aBorrar !== null} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{aBorrar?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>Los residentes dejarán de ver este botón en la app.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmarBorrado()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Nuevo orden de ids al soltar `activo` sobre `sobre`; `null` si no cambia nada. */
export function reordenarIds(ids: number[], activo: number, sobre: number | undefined): number[] | null {
  if (sobre === undefined || activo === sobre) return null
  const desde = ids.indexOf(activo)
  const hasta = ids.indexOf(sobre)
  if (desde < 0 || hasta < 0) return null
  return arrayMove(ids, desde, hasta)
}

function FilaBoton({
  boton: b,
  indice: i,
  total,
  lado,
  resaltado,
  pendiente,
  onEnfoque,
  onMover,
  onEditar,
  onEliminar,
}: {
  boton: BotonApp
  indice: number
  total: number
  lado: 'mitad' | 'completo'
  resaltado: boolean
  pendiente: boolean
  onEnfoque: (id: number | null) => void
  onMover: (delta: -1 | 1) => void
  onEditar: () => void
  onEliminar: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id,
    disabled: pendiente,
  })
  const { Icon } = ICONO_INFO[b.icono]
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={() => onEnfoque(b.id)}
      onMouseLeave={() => onEnfoque(null)}
      className={cn(
        'relative flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 pr-2 transition-colors motion-reduce:transition-none',
        (resaltado || isDragging) && 'border-primary/50 bg-primary-light/40',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar ${b.nombre}`}
        className="flex h-9 w-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="w-4 text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{b.nombre}</p>
        <p className="truncate text-xs">
          {b.salida_id ? (
            <span className="text-muted-foreground">{b.salida_nombre ?? 'Salida'}</span>
          ) : (
            <span className="font-medium text-warning-foreground">Sin salida</span>
          )}
          <span className="text-muted-foreground">
            {' · '}
            {lado === 'completo' ? 'Ancho completo' : 'Media fila'}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Subir ${b.nombre}`}
          disabled={i === 0 || pendiente}
          onClick={() => onMover(-1)}
        >
          <ArrowUp />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Bajar ${b.nombre}`}
          disabled={i === total - 1 || pendiente}
          onClick={() => onMover(1)}
        >
          <ArrowDown />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Editar ${b.nombre}`} onClick={onEditar}>
          <Pencil />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Eliminar ${b.nombre}`}
          className="text-danger-foreground"
          onClick={onEliminar}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
