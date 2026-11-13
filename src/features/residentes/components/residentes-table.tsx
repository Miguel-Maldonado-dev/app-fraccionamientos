'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import { PersonCell } from '@/components/person-cell'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/dates'
import type { Tables } from '@/lib/supabase/types'
import type { DispositivoLigado, ResidenteConDomicilio } from '../queries'
import { ResidenteActions } from './residente-actions'

type Row = ResidenteConDomicilio

function columnas(accesoApp: boolean, dispositivos: DispositivoLigado[] | undefined, puedeDesligar: boolean) {
  const cols: Column<Row>[] = [
    {
      key: 'nombre',
      header: 'Residente',
      cell: (r) => <PersonCell name={r.nombre} />,
      sortValue: (r) => r.nombre ?? '',
    },
    { key: 'telefono', header: 'Teléfono', cell: (r) => r.telefono ?? '—' },
    {
      key: 'direccion',
      header: 'Domicilio',
      cell: (r) => (
        <Link
          href={`/domicilios/${r.domicilio_id}`}
          className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {r.direccion ?? '—'}
        </Link>
      ),
      sortValue: (r) => r.direccion ?? '',
    },
    {
      key: 'es_principal',
      header: 'Principal',
      hideBelow: 'md',
      cell: (r) =>
        r.es_principal ? (
          <span
            role="img"
            aria-label="Residente principal"
            className="flex size-6 items-center justify-center rounded-full bg-success-light text-success-foreground"
          >
            <Check className="size-4" />
          </span>
        ) : null,
    },
  ]
  if (accesoApp) {
    cols.push({
      key: 'app',
      header: 'App',
      hideBelow: 'lg',
      cell: (r) => {
        const dispositivo = dispositivos?.find((d) => d.user_id === r.user_id)
        return (
          <div>
            <Badge variant={r.user_id !== null ? 'success' : 'neutral'}>
              {r.user_id !== null ? 'Con acceso' : 'Sin acceso'}
            </Badge>
            {dispositivos && r.user_id !== null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {dispositivo
                  ? `Dispositivo: ${dispositivo.nombre || 'Sin nombre'} · ligado el ${formatDate(dispositivo.ligado_en.slice(0, 10))}`
                  : 'Sin dispositivo'}
              </p>
            ) : null}
          </div>
        )
      },
    })
  }
  // Mismas acciones que en el detalle del domicilio (editar, eliminar y, con acceso a la app, las de la cuenta).
  cols.push({
    key: 'acciones',
    header: 'Acciones',
    align: 'right',
    cell: (r) => {
      // `direccion` solo es para la tabla; las acciones reciben la fila de `residentes`.
      const residente: Tables<'residentes'> = {
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        es_principal: r.es_principal,
        domicilio_id: r.domicilio_id,
        fraccionamiento_id: r.fraccionamiento_id,
        user_id: r.user_id,
        created_at: r.created_at,
      }
      return (
        <ResidenteActions
          domicilioId={r.domicilio_id}
          residente={residente}
          accesoApp={accesoApp}
          puedeDesligar={puedeDesligar && dispositivos !== undefined}
        />
      )
    },
  })
  return cols
}

export function ResidentesTable({
  rows,
  accesoApp = false,
  dispositivos,
  puedeDesligar = false,
}: {
  rows: Row[]
  accesoApp?: boolean
  dispositivos?: DispositivoLigado[]
  puedeDesligar?: boolean
}) {
  return (
    <DataTable
      columns={columnas(accesoApp, dispositivos, puedeDesligar)}
      rows={rows}
      getRowKey={(r) => r.id}
      entityLabel="residentes"
      emptyTitle="Sin residentes"
      emptyDescription="No hay residentes para mostrar."
    />
  )
}
