'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/empty-state'
import { MetricStrip } from '@/components/metric-strip'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/action-result'
import type { ResultadoProcesar } from '../actions'
import type { Tarea } from '../tipos'
import { TareasTabla } from './tareas-tabla'

type Acciones = {
  procesar: () => Promise<ActionResult<ResultadoProcesar>>
  reintentar: (id: string) => Promise<ActionResult>
}

const MSG_EN_CURSO = 'Ya hay una sincronización en curso; intenta en unos minutos.'

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(
    new Date(iso),
  )
}

export function PanelSincronizacion({
  resumen,
  tareas,
  acciones,
  tieneInstalacion,
  mensajeSinInstalacion = 'Pide al super admin vincular la instalación de access-core',
  modo = 'app',
}: {
  resumen: { pendientes: number; errores: number; ultimaOk: string | null }
  tareas: (Tarea & { direccion: string | null })[]
  acciones: Acciones
  tieneInstalacion: boolean
  mensajeSinInstalacion?: string
  modo?: 'app' | 'consola'
}) {
  const router = useRouter()
  const [procesando, setProcesando] = useState(false)
  const [reintentando, setReintentando] = useState<string | null>(null)

  if (!tieneInstalacion) {
    return <EmptyState title="Sin instalación vinculada" description={mensajeSinInstalacion} />
  }

  async function procesar() {
    setProcesando(true)
    try {
      const r = await acciones.procesar()
      if (!r.ok) toast.error(r.error)
      else if (r.data.noConfigurado) toast.error('access-core no está configurado')
      else if (r.data.omitido) toast.error(MSG_EN_CURSO)
      else if (r.data.detenidoPor429) toast.error('access-core pidió esperar; se reintentará después.')
      else if (r.data.fallidas > 0) {
        toast.error(`Se procesaron ${r.data.procesadas} tareas; ${r.data.fallidas} con error.`)
      } else toast.success('Sincronización procesada')
      router.refresh()
    } finally {
      setProcesando(false)
    }
  }

  async function reintentar(id: string) {
    setReintentando(id)
    try {
      const r = await acciones.reintentar(id)
      if (r.ok) toast.success('Tarea reintentada')
      else toast.error(r.error)
      router.refresh()
    } finally {
      setReintentando(null)
    }
  }

  return (
    <div className="space-y-4">
      <MetricStrip
        featured={{ label: 'Pendientes', value: String(resumen.pendientes), icon: Clock, tone: 'info' }}
        items={[
          { label: 'Con error', value: String(resumen.errores), icon: AlertTriangle, tone: resumen.errores > 0 ? 'danger' : 'neutral' },
          { label: 'Última sincronización', value: formatearFecha(resumen.ultimaOk), icon: CheckCircle2, tone: 'success' },
        ]}
      />
      <div className="flex justify-end">
        <Button onClick={procesar} loading={procesando}>
          <RefreshCw />
          Procesar ahora
        </Button>
      </div>
      {tareas.length === 0 ? (
        <EmptyState title="Todo está sincronizado" description="No hay tareas pendientes ni con error." icon={CheckCircle2} />
      ) : (
        <TareasTabla tareas={tareas} onReintentar={reintentar} reintentando={reintentando} modo={modo} />
      )}
    </div>
  )
}
