import { Banknote, Calendar, Coins, FileText, Plus, Receipt } from 'lucide-react'
import { CARD_TABLE_HEAD_ROW, CardTableHead } from '@/components/card-table-head'
import { EmptyState } from '@/components/empty-state'
import { Money } from '@/components/money'
import { SectionCard } from '@/components/section-card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import type { Tables } from '@/lib/supabase/types'
import type { PagoInfo } from '../queries'
import { ReciboButton } from './recibo-button'
import { RegistrarPagoExtraDialog } from './registrar-pago-extra-dialog'

export function PagosExtraSection({
  domicilioId,
  pagos,
  puedeGestionar,
  domicilios,
  conceptos,
  metodos,
}: {
  domicilioId: number
  pagos: PagoInfo[]
  puedeGestionar: boolean
  domicilios: { id: number; direccion: string }[]
  conceptos: Tables<'conceptos_pago'>[]
  metodos: Tables<'metodos_pago'>[]
}) {
  return (
    <SectionCard
      title="Pagos extra"
      icon={Banknote}
      flush
      description="Cobros adicionales del domicilio"
      action={
        puedeGestionar && (
          <RegistrarPagoExtraDialog
            domicilioId={domicilioId}
            domicilios={domicilios}
            conceptos={conceptos}
            metodos={metodos}
            trigger={
              <Button size="sm">
                <Plus />
                Pago Extra
              </Button>
            }
          />
        )
      }
    >
      {pagos.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            icon={Receipt}
            title="Sin pagos extra"
            description="No hay pagos extra registrados para este domicilio."
          />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={CARD_TABLE_HEAD_ROW}>
                <CardTableHead icon={FileText}>Concepto</CardTableHead>
                <CardTableHead icon={Coins} className="text-right">
                  Importe
                </CardTableHead>
                <CardTableHead icon={Calendar}>Fecha de pago</CardTableHead>
                <CardTableHead className="text-right">Acciones</CardTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.concepto}</TableCell>
                  <TableCell className="text-right font-semibold">
                    <Money value={p.importe} />
                  </TableCell>
                  <TableCell>{formatDate(p.fecha_pago)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <ReciboButton pagoId={p.id!} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  )
}
