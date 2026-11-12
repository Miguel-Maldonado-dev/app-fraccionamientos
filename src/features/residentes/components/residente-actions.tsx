'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { Tables } from '@/lib/supabase/types'
import { eliminarResidente } from '../actions'
import { MSG_RESIDENTE_ELIMINADO } from '../messages'
import type { AccionesResidentes } from './acciones'
import { ResidenteDialog } from './residente-dialog'

export function ResidenteActions({
  domicilioId,
  residente,
  acciones,
}: {
  domicilioId: number
  residente: Tables<'residentes'>
  acciones?: AccionesResidentes
}) {
  const router = useRouter()

  async function onConfirm() {
    const result = await (acciones?.eliminar ?? eliminarResidente)(residente.id, domicilioId)
    if (!result.ok) throw new Error(result.error)
    toast.success(MSG_RESIDENTE_ELIMINADO)
    router.refresh()
  }

  return (
    <div className="flex justify-end gap-1">
      <ResidenteDialog
        domicilioId={domicilioId}
        residente={residente}
        acciones={acciones}
        trigger={
          <Button variant="secondary" size="icon-sm" aria-label={`Editar ${residente.nombre}`}>
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        title="Eliminar Residente"
        description="¿Deseas eliminar este residente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={onConfirm}
        trigger={
          <Button
            variant="secondary"
            size="icon-sm"
            className="text-danger hover:bg-danger-light"
            aria-label={`Eliminar ${residente.nombre}`}
          >
            <Trash2 />
          </Button>
        }
      />
    </div>
  )
}
