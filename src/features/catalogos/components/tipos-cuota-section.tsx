import { Pencil, Plus, Receipt } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Money } from '@/components/money'
import { SectionCard } from '@/components/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
        <EmptyState icon={Receipt} title="Sin elementos" description="Agrega el primero con el botón Agregar." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">{config.etiquetaMonto}</TableHead>
              <TableHead>Medios de acceso</TableHead>
              <TableHead>Permiso al corriente</TableHead>
              <TableHead>Permiso moroso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
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
                        <Button variant="secondary" size="icon-sm" aria-label={`Editar ${r.nombre}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
