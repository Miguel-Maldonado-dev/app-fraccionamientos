import {
  Activity,
  Ban,
  Calendar,
  CalendarClock,
  CircleCheck,
  Clock,
  Coins,
  FileText,
  Pencil,
  Receipt,
} from 'lucide-react'
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
import {
  CancelarCuotasDialog,
  CuotaCheckbox,
  ReactivarCuotasButton,
  SeleccionCuotasProvider,
} from './cancelar-cuotas-dialog'
import { EditarCuotaDialog } from './editar-cuota-dialog'
import { GenerarCuotaDomicilioDialog } from './generar-cuota-domicilio-dialog'

const CANCELADA = 'Cancelada'

const FECHA = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeZone: 'America/Mexico_City',
})

export function CuotasSection({
  domicilioId,
  cuotas,
  puedeGestionar,
  puedeCancelar = false,
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
  /** Solo administrador: casillas para cancelar cuotas sin pago o reactivar canceladas (botones según la selección). */
  puedeCancelar?: boolean
  anios: number[]
  meses: { id: number; name: string }[]
  conceptosDescuento: Tables<'conceptos_descuento'>[]
  conceptosRecargo: Tables<'conceptos_recargo'>[]
  renderPagar?: (cuota: CuotaInfo) => ReactNode
  renderRecibo?: (cuota: CuotaInfo) => ReactNode
}) {
  const pagadas = cuotas.filter((c) => estatusVisible(c) === 'Pagado').length
  const pendientes = cuotas.filter((c) => esEditable(estatusVisible(c))).length
  const canceladas = cuotas.filter((c) => estatusVisible(c) === CANCELADA).length
  const cancelables = puedeCancelar
    ? cuotas
        .filter((c) => c.id != null && esEditable(estatusVisible(c)))
        .map((c) => ({
          id: c.id!,
          periodo: c.periodo,
          concepto: c.concepto,
          importe: c.importe_cuota,
        }))
    : []
  const reactivables = puedeCancelar
    ? cuotas.filter((c) => c.id != null && estatusVisible(c) === CANCELADA).map((c) => c.id!)
    : []
  const conCasillas = cancelables.length > 0 || reactivables.length > 0
  return (
    <SeleccionCuotasProvider>
      <SectionCard
        title="Cuotas"
        icon={Coins}
        flush
        description="Administración de cuotas y pagos"
        stats={
          <>
            <StatChip icon={CircleCheck} valor={pagadas} etiqueta="Pagadas" tono="success" />
            <StatChip icon={Clock} valor={pendientes} etiqueta="Pendientes" />
            {canceladas > 0 && <StatChip icon={Ban} valor={canceladas} etiqueta="Canceladas" />}
          </>
        }
        action={
          (puedeGestionar || conCasillas) && (
            <div className="flex flex-wrap items-center gap-2">
              {cancelables.length > 0 && <CancelarCuotasDialog domicilioId={domicilioId} cuotas={cancelables} />}
              {reactivables.length > 0 && <ReactivarCuotasButton domicilioId={domicilioId} cuotaIds={reactivables} />}
              {puedeGestionar && <GenerarCuotaDomicilioDialog domicilioId={domicilioId} anios={anios} meses={meses} />}
            </div>
          )
        }
      >
        {cuotas.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={Receipt}
              title="Sin cuotas"
              description="No hay cuotas registradas para este domicilio."
            />
          </div>
        ) : (
          <div className="px-5 pb-5">
            <Table>
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow className={CARD_TABLE_HEAD_ROW}>
                  {conCasillas && (
                    <CardTableHead className="w-8">
                      <span className="sr-only">Seleccionar</span>
                    </CardTableHead>
                  )}
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
                  const cancelada = estatus === CANCELADA
                  return (
                    <TableRow key={c.id} className={cancelada ? 'opacity-60' : undefined}>
                      {conCasillas && (
                        <TableCell>
                          {(editable || cancelada) && c.id != null && (
                            <CuotaCheckbox
                              cuotaId={c.id}
                              label={`Seleccionar cuota ${c.periodo ?? ''} ${c.concepto ?? ''}`}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell>{c.periodo ? <PeriodoPill>{c.periodo}</PeriodoPill> : '—'}</TableCell>
                      <TableCell>{c.concepto}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <Money value={c.importe_cuota} />
                      </TableCell>
                      <TableCell>{c.fecha_vencimiento_formated}</TableCell>
                      <TableCell>
                        <StatusBadge status={estatus} />
                        {cancelada && (
                          <p className="mt-1 max-w-56 text-xs whitespace-normal text-muted-foreground">
                            {textoCancelacion(c)}
                          </p>
                        )}
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
    </SeleccionCuotasProvider>
  )
}

function formatFecha(iso: string) {
  return FECHA.format(new Date(iso))
}

function textoCancelacion(c: CuotaInfo) {
  const por = c.cancelada_por_nombre ? ` por ${c.cancelada_por_nombre}` : ''
  const el = c.cancelada_en ? ` el ${formatFecha(c.cancelada_en)}` : ''
  return `Cancelada${por}${el}: ${c.motivo_cancelacion ?? ''}`
}

function esEditable(estatus: string | null) {
  return estatus === 'Pendiente' || estatus === 'En gracia' || estatus === 'Vencido'
}
