'use client'

import Link from 'next/link'
import { Eye } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import { PersonCell } from '@/components/person-cell'
import { RowActions } from '@/components/row-actions'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/dates'
import type { DomicilioInfo } from '../queries'

function columnas(
  detalleHref: (id: number) => string,
  mostrarEstatus: boolean,
  mostrarTipoCuota: boolean,
): Column<DomicilioInfo>[] {
  return [
    {
      key: 'direccion',
      header: 'Dirección',
      cell: (r) =>
        r.id == null ? (
          <span className="font-medium">{r.direccion}</span>
        ) : (
          <Link
            href={detalleHref(r.id)}
            className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {r.direccion}
          </Link>
        ),
      sortValue: (r) => r.direccion ?? '',
    },
    {
      key: 'fecha_alta',
      header: 'Fecha de Registro',
      cell: (r) => (r.fecha_alta ? formatDate(r.fecha_alta) : ''),
      sortValue: (r) => r.fecha_alta ?? '',
      hideBelow: 'md',
    },
    {
      key: 'residente',
      header: 'Residente Principal',
      cell: (r) => <PersonCell name={r.residente_principal} />,
      sortValue: (r) => r.residente_principal ?? '',
    },
    ...(mostrarTipoCuota
      ? [
          {
            key: 'tipo_cuota',
            header: 'Tipo de cuota',
            cell: (r: DomicilioInfo) => r.tipo_cuota ?? 'Sin asignar',
            sortValue: (r: DomicilioInfo) => r.tipo_cuota ?? '',
            hideBelow: 'md' as const,
          },
        ]
      : []),
    ...(mostrarEstatus
      ? [
          {
            key: 'estatus',
            header: 'Estatus',
            cell: (r: DomicilioInfo) => <StatusBadge status={r.estatus} />,
            sortValue: (r: DomicilioInfo) => r.estatus ?? '',
          },
        ]
      : []),
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      cell: (r) => (
        <RowActions
          label={`Acciones de ${r.direccion ?? 'domicilio'}`}
          items={[{ label: 'Ver detalle', icon: Eye, href: detalleHref(r.id!) }]}
        />
      ),
    },
  ]
}

export function DomiciliosTable({
  rows,
  mostrarEstatus = true,
  mostrarTipoCuota = false,
  hrefBase = '/domicilios',
  emptyDescription = 'Registra el primer domicilio con el botón Nuevo Domicilio.',
}: {
  rows: DomicilioInfo[]
  /** La consola del super admin no muestra el estado de pago. */
  mostrarEstatus?: boolean
  mostrarTipoCuota?: boolean
  /** Prefijo de los enlaces al detalle (`<hrefBase>/<id>`); es texto para poder venir de un Server Component. */
  hrefBase?: string
  emptyDescription?: string
}) {
  const detalleHref = (id: number) => `${hrefBase}/${id}`
  const columns = columnas(detalleHref, mostrarEstatus, mostrarTipoCuota)
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id ?? r.direccion ?? ''}
      rowHref={(r) => (r.id == null ? undefined : detalleHref(r.id))}
      entityLabel="domicilios"
      emptyTitle="Sin domicilios"
      emptyDescription={emptyDescription}
    />
  )
}
