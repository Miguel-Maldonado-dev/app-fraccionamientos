'use client'

import { Pencil, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { todayISO } from '@/lib/dates'
import type { ActionResult } from '@/lib/action-result'
import type { MedioAcceso } from '@/lib/constants'
import type { Tables } from '@/lib/supabase/types'
import { actualizarDomicilio } from '../actions'
import { MSG_DOMICILIO_ACTUALIZADO } from '../messages'
import { avisoMediosOcultos, contarRegistrosQueSeOcultan, type RegistrosPorMedio } from '../medios-ocultos'
import type { DomicilioInfo } from '../queries'
import type { DomicilioDatosInput, DomicilioInput } from '../schemas'
import { DomicilioForm } from './domicilio-form'

const FORM_ID = 'edit-domicilio-form'

export function EditDomicilioDialog({
  domicilio,
  conceptos,
  conceptoActual,
  trigger,
  actualizar = actualizarDomicilio,
  editarTipoCuota = true,
  mediosPorConcepto = {},
  registros = { tarjeta: 0, control: 0 },
}: {
  domicilio: DomicilioInfo
  conceptos: Tables<'conceptos_pago'>[]
  conceptoActual: number | null
  trigger?: ReactNode
  /** Por defecto, la acción del fraccionamiento; la consola pasa la suya ligada al fraccionamiento. */
  actualizar?: (id: number, input: DomicilioDatosInput & Pick<DomicilioInput, 'conceptoId'>) => Promise<ActionResult>
  /** Con `false` se oculta el tipo de cuota y se llama a `actualizar` sin `conceptoId`. */
  editarTipoCuota?: boolean
  /** Medios de acceso de cada tipo de cuota, para avisar qué registros se ocultan al cambiarlo. */
  mediosPorConcepto?: Record<number, MedioAcceso[]>
  /** Cuántas tarjetas y controles tiene el domicilio. */
  registros?: RegistrosPorMedio
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [conceptoElegido, setConceptoElegido] = useState<number | null>(conceptoActual)

  const medios = (id: number | null) => (id === null ? [] : (mediosPorConcepto[id] ?? []))
  const aviso =
    editarTipoCuota && conceptoElegido !== conceptoActual
      ? avisoMediosOcultos(contarRegistrosQueSeOcultan(registros, medios(conceptoActual), medios(conceptoElegido)))
      : null

  function handleOpenChange(next: boolean) {
    if (next) setConceptoElegido(conceptoActual)
    setOpen(next)
  }

  async function onSubmit(input: DomicilioInput) {
    setSubmitting(true)
    try {
      const datos: DomicilioDatosInput = {
        direccion: input.direccion,
        fechaAlta: input.fechaAlta,
        observaciones: input.observaciones,
      }
      const result = await actualizar(domicilio.id!, editarTipoCuota ? input : datos)
      if (result.ok) {
        toast.success(MSG_DOMICILIO_ACTUALIZADO)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormDialog
      title="Editar Domicilio"
      description="Actualiza los datos del domicilio."
      trigger={
        trigger ?? (
          <Button variant="ghost" size="icon" aria-label="Editar domicilio">
            <Pencil />
          </Button>
        )
      }
      open={open}
      onOpenChange={handleOpenChange}
      footer={
        <>
          <Button variant="secondary" type="button" disabled={submitting} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={submitting}>
            Guardar
          </Button>
        </>
      }
    >
      <DomicilioForm
        defaultValues={{
          direccion: domicilio.direccion ?? '',
          fechaAlta: domicilio.fecha_alta ?? todayISO(),
          conceptoId: editarTipoCuota ? (conceptoActual ?? undefined) : undefined,
          observaciones: domicilio.observaciones ?? '',
        }}
        conceptos={conceptos}
        onSubmit={onSubmit}
        submitLabel="Guardar"
        allowSinAsignar={conceptoActual === null}
        mostrarTipoCuota={editarTipoCuota}
        formId={FORM_ID}
        hideSubmit
        onConceptoChange={(id) => setConceptoElegido(id ?? null)}
      />
      {aviso ? (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-md bg-warning-light px-3 py-2 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{aviso}</span>
        </p>
      ) : null}
    </FormDialog>
  )
}
