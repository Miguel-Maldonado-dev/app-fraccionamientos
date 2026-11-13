import { Activity, Calendar, CalendarClock, CircleCheck, Clock, Coins, FileText, Pencil, Receipt } from 'lucide-react'
import type { ReactNode } from 'react'
import { CARD_TABLE_HEAD_ROW, CardTableHead } from '@/components/card-table-head'
import { EmptyState } from '@/components/empty-state'
import { IconButton } from '@/components/icon-button'
import { Money } from '@/components/money'
import { PeriodoPill } from '@/components/periodo-pill'
import { SectionCard } from '@/components/section-card'
import { StatChip } from '@/components/stat-chip'
import { StatusBadge } from '@/components/status-badge'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import type { Tables } from '@/lib/supabase/types'
import { estatusVisible } from '../estatus'
import type { CuotaInfo } from '../queries'
import { EditarCuotaDialog } from './editar-cuota-dialog'
import { GenerarCuotaDomicilioDialog } from './generar-cuota-domicilio-dialog'

export function CuotasSection({
  domicilioId,
  cuotas,
  puedeGestionar,
  anios,
  meses,
  conceptosDescuento,
  conceptosRecargo,
  renderPagar,
  renderRecibo,
}: {
  domicilioId: number
  cuotas: CuotaInfo[]
  puedeGestionar: boolean
  anios: number[]
  meses: { id: number; name: string }[]
  conceptosDescuento: Tables<'conceptos_descuento'>[]
  conceptosRecargo: Tables<'conceptos_recargo'>[]
  renderPagar?: (cuota: CuotaInfo) => ReactNode
  renderRecibo?: (cuota: CuotaInfo) => ReactNode
}) {
  const pagadas = cuotas.filter((c) => estatusVisible(c) === 'Pagado').length
  const pendientes = cuotas.filter((c) => esEditable(estatusVisible(c))).length
  return (
    <SectionCard
      title="Cuotas"
      icon={Coins}
      flush
      description="Administración de cuotas y pagos"
      stats={
        <>
          <StatChip icon={CircleCheck} valor={pagadas} etiqueta="Pagadas" tono="success" />
          <StatChip icon={Clock} valor={pendientes} etiqueta="Pendientes" />
        </>
      }
      action={puedeGestionar && <GenerarCuotaDomicilioDialog domicilioId={domicilioId} anios={anios} meses={meses} />}
    >
      {cuotas.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Receipt} title="Sin cuotas" description="No hay cuotas registradas para este domicilio." />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={CARD_TABLE_HEAD_ROW}>
                <CardTableHead icon={Calendar}>Periodo</CardTableHead>
                <CardTableHead icon={FileText}>Concepto</CardTableHead>
                <CardTableHead icon={Coins} className="text-right">
                  Importe
                </CardTableHead>
                <CardTableHead icon={CalendarClock}>Vencimiento</CardTableHead>
                <CardTableHead icon={Activity}>Estado</CardTableHead>
                <CardTableHead className="text-right">Acciones</CardTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuotas.map((c) => {
                const estatus = estatusVisible(c)
                const editable = esEditable(estatus)
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.periodo ? <PeriodoPill>{c.periodo}</PeriodoPill> : '—'}</TableCell>
                    <TableCell>{c.concepto}</TableCell>
                    <TableCell className="text-right font-semibold">
                      <Money value={c.importe_cuota} />
                    </TableCell>
                    <TableCell>{c.fecha_vencimiento_formated}</TableCell>
                    <TableCell>
                      <StatusBadge status={estatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {puedeGestionar && editable && (
                          <>
                            {renderPagar?.(c)}
                            <EditarCuotaDialog
                              cuota={c}
                              domicilioId={domicilioId}
                              conceptosDescuento={conceptosDescuento}
                              conceptosRecargo={conceptosRecargo}
                              trigger={<IconButton icon={Pencil} label="Editar cuota" />}
                            />
                          </>
                        )}
                        {estatus === 'Pagado' && renderRecibo?.(c)}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  )
}

function esEditable(estatus: string | null) {
  return estatus === 'Pendiente' || estatus === 'En gracia' || estatus === 'Vencido'
}
