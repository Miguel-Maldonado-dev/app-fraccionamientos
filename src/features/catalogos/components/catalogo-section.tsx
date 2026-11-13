import { BadgePercent, Banknote, Coins, Pencil, Plus, Tag, TriangleAlert, type LucideIcon } from 'lucide-react'
import { CARD_TABLE_HEAD_ROW, CardTableHead } from '@/components/card-table-head'
import { EmptyState } from '@/components/empty-state'
import { IconButton } from '@/components/icon-button'
import { Money } from '@/components/money'
import { SectionCard } from '@/components/section-card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { CATALOGOS, type CatalogoSimple, type ElementoCatalogo } from '../catalogos'
import { CatalogoDialog, type GuardarCatalogo } from './catalogo-dialog'

const ICONOS: Record<CatalogoSimple, LucideIcon> = {
  extras: Banknote,
  descuentos: BadgePercent,
  recargos: TriangleAlert,
}

export function CatalogoSection({
  catalogo,
  rows,
  guardar,
}: {
  catalogo: CatalogoSimple
  rows: ElementoCatalogo[]
  guardar?: GuardarCatalogo
}) {
  const config = CATALOGOS[catalogo]
  const Icono = ICONOS[catalogo]
  return (
    <SectionCard
      title={config.titulo}
      description={config.descripcion}
      icon={Icono}
      flush
      action={
        <CatalogoDialog
          catalogo={catalogo}
          guardar={guardar}
          trigger={
            <Button size="sm">
              <Plus />
              Agregar
            </Button>
          }
        />
      }
    >
      {rows.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Icono} title="Sin elementos" description="Agrega el primero con el botón Agregar." />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={CARD_TABLE_HEAD_ROW}>
                <CardTableHead icon={Tag}>Nombre</CardTableHead>
                <CardTableHead icon={Coins} className="text-right">
                  {config.etiquetaMonto}
                </CardTableHead>
                <CardTableHead className="text-right">Acciones</CardTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell className="text-right">
                    <Money value={r.importe} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <CatalogoDialog
                        catalogo={catalogo}
                        item={r}
                        guardar={guardar}
                        trigger={
                          <IconButton icon={Pencil} label={`Editar ${r.nombre}`} />
                        }
                      />
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
