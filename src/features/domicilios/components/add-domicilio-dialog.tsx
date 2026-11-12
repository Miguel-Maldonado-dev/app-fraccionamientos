'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/action-result'
import type { Tables } from '@/lib/supabase/types'
import { crearDomicilio } from '../actions'
import { MSG_DOMICILIO_CREADO } from '../messages'
import type { DomicilioInput } from '../schemas'
import { DomicilioForm } from './domicilio-form'

const FORM_ID = 'domicilio-form'

export function AddDomicilioDialog({
  conceptos,
  crear = crearDomicilio,
  mostrarImporte = true,
  permitirSinAsignar = true,
}: {
  conceptos: (Pick<Tables<'conceptos_pago'>, 'id' | 'nombre'> & Partial<Pick<Tables<'conceptos_pago'>, 'importe'>>)[]
  /** Con `false` (consola) los tipos de cuota se muestran sin importe. */
  mostrarImporte?: boolean
  /** Con `false` (consola) el tipo de cuota es obligatorio: no hay opción "Sin asignar". */
  permitirSinAsignar?: boolean
  /** Por defecto, la acción del fraccionamiento; la consola pasa la suya ligada al fraccionamiento. */
  crear?: (input: DomicilioInput) => Promise<ActionResult<{ id: number }>>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(input: DomicilioInput) {
    setSubmitting(true)
    try {
      const result = await crear(input)
      if (result.ok) {
        toast.success(MSG_DOMICILIO_CREADO)
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
      title="Nuevo Domicilio"
      description="Registra un nuevo domicilio del fraccionamiento."
      trigger={
        <Button>
          <Plus /> Nuevo Domicilio
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      footer={
        <>
          <Button variant="secondary" type="button" disabled={submitting} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={submitting}>
            Guardar
          </Button>
        </>
      }
    >
      <DomicilioForm
        conceptos={conceptos}
        mostrarImporte={mostrarImporte}
        allowSinAsignar={permitirSinAsignar}
        onSubmit={onSubmit}
        submitLabel="Guardar"
        formId={FORM_ID}
        hideSubmit
      />
    </FormDialog>
  )
}
