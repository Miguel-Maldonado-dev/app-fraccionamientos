'use client'

import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionCard } from '@/components/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { forzarAcceso } from '../actions'
import { MSG_ACCESO_AJUSTADO } from '../messages'

export type EstadoAcceso = {
  es_moroso: boolean
  acceso_forzado: string | null
  forzado_por_nombre: string | null
  forzado_en: string | null
}

const AVISO = 'El ajuste se quita solo cuando cambie la situación de pago del domicilio.'

function fechaLarga(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'America/Mexico_City' }).format(new Date(iso))
}

/** Ajuste manual del acceso de un domicilio. Los botones son solo del administrador. */
export function AccesoForzado({ domicilioId, estado, puedeAjustar }: { domicilioId: number; estado: EstadoAcceso; puedeAjustar: boolean }) {
  const router = useRouter()

  async function aplicar(valor: 'activo' | 'inactivo' | null) {
    const r = await forzarAcceso(domicilioId, valor)
    if (!r.ok) throw new Error(r.error)
    toast.success(MSG_ACCESO_AJUSTADO)
    router.refresh()
  }

  const forzado = estado.acceso_forzado
  const quien = estado.forzado_por_nombre ?? 'un administrador'

  return (
    <SectionCard
      title="Acceso"
      icon={ShieldCheck}
      description={estado.es_moroso ? 'El domicilio está moroso según las reglas de cobro.' : 'El domicilio está al corriente según las reglas de cobro.'}
    >
      <div className="flex flex-wrap items-center gap-3">
        {forzado ? (
          <>
            <Badge variant={forzado === 'activo' ? 'success' : 'danger'} dot>
              {`Acceso ${forzado === 'activo' ? 'activado' : 'desactivado'} manualmente por ${quien} el ${fechaLarga(estado.forzado_en)}`}
            </Badge>
            {puedeAjustar ? (
              <ConfirmDialog
                tone="default"
                title="Quitar ajuste"
                description={`El acceso volverá a seguir las reglas de cobro. ${AVISO}`}
                confirmLabel="Quitar ajuste"
                onConfirm={() => aplicar(null)}
                trigger={<Button variant="secondary">Quitar ajuste</Button>}
              />
            ) : null}
          </>
        ) : puedeAjustar ? (
          estado.es_moroso ? (
            <ConfirmDialog
              tone="default"
              title="Activar acceso"
              description={`Se dará acceso al domicilio aunque esté moroso. ${AVISO}`}
              confirmLabel="Activar acceso"
              onConfirm={() => aplicar('activo')}
              trigger={<Button>Activar acceso</Button>}
            />
          ) : (
            <ConfirmDialog
              title="Desactivar acceso"
              description={`Se quitará el acceso al domicilio aunque esté al corriente. ${AVISO}`}
              confirmLabel="Desactivar acceso"
              onConfirm={() => aplicar('inactivo')}
              trigger={<Button variant="destructive">Desactivar acceso</Button>}
            />
          )
        ) : (
          <p className="text-sm text-muted-foreground">Sin ajuste manual.</p>
        )}
      </div>
    </SectionCard>
  )
}
