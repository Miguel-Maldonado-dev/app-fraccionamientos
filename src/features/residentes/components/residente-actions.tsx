'use client'

import { KeyRound, Pencil, Unlink, Smartphone, Trash2, UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { IconButton } from '@/components/icon-button'
import type { Tables } from '@/lib/supabase/types'
import { eliminarResidente } from '../actions'
import { desligarDispositivo, quitarAccesoApp } from '../cuentas-actions'
import { MSG_ACCESO_APP_QUITADO, MSG_DISPOSITIVO_DESLIGADO, MSG_RESIDENTE_ELIMINADO } from '../messages'
import type { AccionesResidentes } from './acciones'
import { AccesoAppDialog } from './acceso-app-dialog'
import { ResidenteDialog } from './residente-dialog'

export function ResidenteActions({
  domicilioId,
  residente,
  acciones,
  accesoApp = false,
  puedeDesligar = false,
}: {
  domicilioId: number
  residente: Tables<'residentes'>
  acciones?: AccionesResidentes
  /** Acciones de la cuenta de la app (administrador y tesorero; no en la consola). */
  accesoApp?: boolean
  /** Desligar el dispositivo de la cuenta: solo administrador. */
  puedeDesligar?: boolean
}) {
  const router = useRouter()

  async function onConfirm() {
    const result = await (acciones?.eliminar ?? eliminarResidente)(residente.id, domicilioId)
    if (!result.ok) throw new Error(result.error)
    toast.success(MSG_RESIDENTE_ELIMINADO)
    router.refresh()
  }

  async function onQuitarAcceso() {
    const result = await quitarAccesoApp(residente.id)
    if (!result.ok) throw new Error(result.error)
    toast.success(MSG_ACCESO_APP_QUITADO)
    router.refresh()
  }

  async function onDesligar() {
    const result = await desligarDispositivo(residente.id)
    if (!result.ok) throw new Error(result.error)
    toast.success(MSG_DISPOSITIVO_DESLIGADO)
    router.refresh()
  }

  const tieneAcceso = residente.user_id !== null

  return (
    <div className="flex justify-end gap-2">
      {accesoApp && !tieneAcceso && (
        <AccesoAppDialog
          residente={residente}
          modo="dar"
          trigger={<IconButton icon={Smartphone} label={`Dar acceso a la app a ${residente.nombre}`} />}
        />
      )}
      {accesoApp && tieneAcceso && (
        <>
          <AccesoAppDialog
            residente={residente}
            modo="restablecer"
            trigger={<IconButton icon={KeyRound} label={`Restablecer contraseña de ${residente.nombre}`} />}
          />
          {puedeDesligar && (
            <ConfirmDialog
              title="Desligar dispositivo"
              description="El residente podrá iniciar sesión en un teléfono nuevo."
              confirmLabel="Desligar dispositivo"
              onConfirm={onDesligar}
              trigger={<IconButton icon={Unlink} label={`Desligar dispositivo de ${residente.nombre}`} />}
            />
          )}
          <ConfirmDialog
            title="Quitar acceso a la app"
            description={`¿Deseas quitar a ${residente.nombre} el acceso a la app? Podrás volver a darlo después.`}
            confirmLabel="Quitar acceso"
            onConfirm={onQuitarAcceso}
            trigger={
              <IconButton icon={UserMinus} label={`Quitar acceso a la app a ${residente.nombre}`} tono="danger" />
            }
          />
        </>
      )}
      <ResidenteDialog
        domicilioId={domicilioId}
        residente={residente}
        acciones={acciones}
        trigger={<IconButton icon={Pencil} label={`Editar ${residente.nombre}`} />}
      />
      <ConfirmDialog
        title="Eliminar Residente"
        description="¿Deseas eliminar este residente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={onConfirm}
        trigger={<IconButton icon={Trash2} label={`Eliminar ${residente.nombre}`} tono="danger" />}
      />
    </div>
  )
}
