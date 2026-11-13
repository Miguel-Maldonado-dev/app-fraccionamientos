import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { Card } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import type { Views } from '@/lib/supabase/types'
import { Receipt } from 'lucide-react'
import { totalImporte } from '../totals'
import { ExportarPagosUsuario } from './exportar-pagos-usuario'
import { PagosUsuarioTabla } from './pagos-usuario-tabla'

type DatosExport = { fraccionamiento: string; usuario: string; inicio: string; fin: string; metodo: string }

export function PagosUsuarioResultado({
  rows,
  exportar,
}: {
  rows: Views<'reporte_pagos_detalle'>[]
  /** Datos del encabezado de la exportación; sin ellos no se muestra el botón. */
  exportar?: DatosExport
}) {
  if (rows.length === 0) return <EmptyState />
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm">
          <MetricCard
            label="Total"
            value={formatMoney(totalImporte(rows))}
            helper="en el periodo seleccionado"
            icon={Receipt}
            tone="primary"
          />
        </div>
        {exportar ? <ExportarPagosUsuario rows={rows} {...exportar} /> : null}
      </div>
      <Card className="p-0">
        <PagosUsuarioTabla rows={rows} />
      </Card>
    </div>
  )
}
