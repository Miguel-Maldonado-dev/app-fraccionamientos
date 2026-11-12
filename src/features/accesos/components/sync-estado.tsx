'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { SyncBadge } from '@/components/sync-badge'
import { reintentarTarea as reintentarTareaFraccionamiento } from '@/features/sincronizacion/actions'
import type { EstadoEntidad } from '@/features/sincronizacion/queries'
import type { ActionResult } from '@/lib/action-result'

/**
 * `SyncBadge` conectado a la acción de reintentar. Por defecto, la del fraccionamiento; la consola pasa
 * la suya ligada al fraccionamiento. Con `puedeReintentar={false}` solo muestra el estado.
 */
export function SyncEstado({
  estado,
  reintentar = reintentarTareaFraccionamiento,
  puedeReintentar = true,
}: {
  estado: EstadoEntidad | null | undefined
  reintentar?: (id: string) => Promise<ActionResult>
  puedeReintentar?: boolean
}) {
  const router = useRouter()
  const [reintentando, setReintentando] = useState(false)
  if (!estado) return null

  async function onReintentar() {
    if (!estado) return
    setReintentando(true)
    try {
      const result = await reintentar(estado.tareaId)
      if (result.ok) {
        toast.success('Se volverá a sincronizar.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setReintentando(false)
    }
  }

  return (
    <SyncBadge
      estado={estado.estado}
      error={estado.error}
      onReintentar={puedeReintentar ? onReintentar : undefined}
      reintentando={reintentando}
    />
  )
}
