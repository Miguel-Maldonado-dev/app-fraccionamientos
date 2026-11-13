import Link from 'next/link'
import { ArrowLeftRight, ArrowRight, Calendar, Coins, FileText, ReceiptText } from 'lucide-react'
import { CARD_TABLE_HEAD_ROW, CardTableHead } from '@/components/card-table-head'
import { DateBlock } from '@/components/date-block'
import { EmptyState } from '@/components/empty-state'
import { Money } from '@/components/money'
import { SectionCard } from '@/components/section-card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { TipoMovimientoCell } from '@/features/movimientos/components/tipo-movimiento-cell'
import { TIPO_MOVIMIENTO } from '@/lib/constants'
import type { Views } from '@/lib/supabase/types'

export function UltimosMovimientos({ rows }: { rows: Views<'movimientos_info'>[] }) {
  return (
    <SectionCard
      title="Últimos movimientos"
      description="Tus transacciones más recientes"
      icon={ReceiptText}
      flush
      action={
        <Button asChild size="sm">
          <Link href="/movimientos">
            Ver todos <ArrowRight />
          </Link>
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="Sin movimientos" description="Aún no hay movimientos registrados." />
      ) : (
        <div className="px-5 pb-5">
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow data-variante="tarjeta" className={CARD_TABLE_HEAD_ROW}>
                <CardTableHead icon={Calendar} className="hidden xl:table-cell">
                  Fecha
                </CardTableHead>
                <CardTableHead icon={FileText}>Concepto</CardTableHead>
                <CardTableHead icon={ArrowLeftRight}>Tipo</CardTableHead>
                <CardTableHead icon={Coins} className="text-right">
                  Importe
                </CardTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const d = r.descripcion ?? ''
                return (
                  <TableRow key={r.id}>
                    <TableCell className="hidden xl:table-cell">
                      <DateBlock fecha={r.fecha_movimiento ?? ''} />
                    </TableCell>
                    {/* max-w-0 + w-full: la columna absorbe el espacio libre y el texto se recorta con puntos suspensivos */}
                    <TableCell className="w-full max-w-0">
                      <span className="block truncate" title={d}>
                        {d}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TipoMovimientoCell tipoId={r.tipo_id} nombre={r.tipo_movimiento} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={r.importe} variant={r.tipo_id === TIPO_MOVIMIENTO.EGRESO ? 'egreso' : 'ingreso'} />
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
