import { Check, House, Phone, Plus, Smartphone, User, Users } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { CARD_TABLE_HEAD_ROW, CardTableHead } from '@/components/card-table-head'
import { EmptyState } from '@/components/empty-state'
import { SectionCard } from '@/components/section-card'
import { StatChip } from '@/components/stat-chip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/dates'
import type { Tables } from '@/lib/supabase/types'
import type { DispositivoLigado } from '../queries'
import type { AccionesResidentes } from './acciones'
import { ResidenteActions } from './residente-actions'
import { ResidenteDialog } from './residente-dialog'

export function ResidentesSection({
  domicilioId,
  residentes,
  acciones,
  accesoApp,
  puedeAgregar = true,
  dispositivos,
  puedeDesligar = false,
}: {
  domicilioId: number
  residentes: Tables<'residentes'>[]
  /** Por defecto, las del fraccionamiento. */
  acciones?: AccionesResidentes
  /**
   * Activa el acceso a la app (casilla al agregar, columna y acciones de cuenta) con el máximo por
   * domicilio. Solo para administrador y tesorero del fraccionamiento; la consola no lo pasa.
   */
  accesoApp?: { max: number }
  /** Solo el administrador crea residentes; el tesorero conserva las acciones de cuenta de cada fila. */
  puedeAgregar?: boolean
  /** Dispositivos ligados de las cuentas de los residentes (solo si se pasan se muestra la insignia). */
  dispositivos?: DispositivoLigado[]
  /** Solo el administrador desliga dispositivos. */
  puedeDesligar?: boolean
}) {
  const conAcceso = residentes.filter((r) => r.user_id !== null).length
  return (
    <SectionCard
      title="Residentes"
      icon={Users}
      flush
      description={accesoApp ? `Acceso a la app: ${conAcceso} de ${accesoApp.max}` : undefined}
      stats={
        accesoApp ? (
          <StatChip icon={Smartphone} valor={`${conAcceso} / ${accesoApp.max}`} etiqueta="con acceso" />
        ) : undefined
      }
      action={
        puedeAgregar ? (
          <ResidenteDialog
            domicilioId={domicilioId}
            acciones={acciones}
            accesoApp={accesoApp !== undefined}
            trigger={
              <Button size="sm">
                <Plus />
                Agregar Residente
              </Button>
            }
          />
        ) : undefined
      }
    >
      {residentes.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            icon={Users}
            title="Sin residentes"
            description="No hay residentes registrados para este domicilio."
          />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={CARD_TABLE_HEAD_ROW}>
                <CardTableHead icon={User}>Nombre</CardTableHead>
                <CardTableHead icon={Phone}>Teléfono</CardTableHead>
                <CardTableHead icon={House}>Residente Principal</CardTableHead>
                {accesoApp && <CardTableHead icon={Smartphone}>App</CardTableHead>}
                <CardTableHead className="text-right">Acciones</CardTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residentes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={r.nombre} size="sm" />
                      <span className="font-medium">{r.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.telefono ?? '—'}</TableCell>
                  <TableCell>
                    {r.es_principal ? (
                      <Badge variant="success">
                        <Check aria-hidden="true" />
                        Sí
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {accesoApp && (
                    <TableCell>
                      <Badge variant={r.user_id !== null ? 'success' : 'neutral'}>
                        {r.user_id !== null ? 'Con acceso' : 'Sin acceso'}
                      </Badge>
                      {dispositivos && r.user_id !== null && (
                        <DispositivoInsignia dispositivo={dispositivos.find((d) => d.user_id === r.user_id)} />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <ResidenteActions
                      domicilioId={domicilioId}
                      residente={r}
                      acciones={acciones}
                      accesoApp={accesoApp !== undefined}
                      puedeDesligar={puedeDesligar && dispositivos !== undefined}
                    />
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

function DispositivoInsignia({ dispositivo }: { dispositivo: DispositivoLigado | undefined }) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {dispositivo
        ? `Dispositivo: ${dispositivo.nombre || 'Sin nombre'} · ligado el ${formatDate(dispositivo.ligado_en.slice(0, 10))}`
        : 'Sin dispositivo'}
    </p>
  )
}
