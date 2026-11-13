import { Coins, KeyRound, Pencil, Plus, Receipt, ShieldAlert, ShieldCheck, Tag } from 'lucide-react'
import { CARD_TABLE_HEAD_ROW, CardTableHead } from '@/components/card-table-head'
import { EmptyState } from '@/components/empty-state'
import { IconButton } from '@/components/icon-button'
import { Money } from '@/components/money'
import { SectionCard } from '@/components/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { MEDIO_LABEL, type MedioAcceso } from '@/lib/constants'
import type { PerfilOpcion } from '../access-core'
import { CATALOGOS, type TipoCuota } from '../catalogos'
import { TipoCuotaDialog, type GuardarTipoCuota } from './tipo-cuota-dialog'

const config = CATALOGOS.cuotas

export function TiposCuotaSection({
  rows,
  guardar,
  mediosHabilitados,
  perfiles,
  tieneInstalacion,
}: {
  rows: TipoCuota[]
  guardar?: GuardarTipoCuota
  mediosHabilitados: MedioAcceso[]
  perfiles: PerfilOpcion[] | null
  tieneInstalacion: boolean
}) {
  const acceso = { mediosHabilitados, perfiles, tieneInstalacion }
  return (
    <SectionCard
      title={config.titulo}
      description={config.descripcion}
      icon={Receipt}
      flush
      action={
        <TipoCuotaDialog
          guardar={guardar}
          {...acceso}
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
          <EmptyState icon={Receipt} title="Sin elementos" description="Agrega el primero con el botón Agregar." />
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
                <CardTableHead icon={KeyRound}>Medios de acceso</CardTableHead>
                <CardTableHead icon={ShieldCheck}>Permiso al corriente</CardTableHead>
                <CardTableHead icon={ShieldAlert}>Permiso moroso</CardTableHead>
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
                    {r.medios.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.medios.map((m) => (
                          <Badge key={m} variant="neutral">
                            {MEDIO_LABEL[m]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{r.perfilCorrienteNombre ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{r.perfilMorosoNombre ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <TipoCuotaDialog
                        item={r}
                        guardar={guardar}
                        {...acceso}
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
