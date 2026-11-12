'use client'

import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { FraccionamientoResumen } from '../queries'
import { FraccionamientoDialog, type InstalacionOpcion } from './fraccionamiento-dialog'

const crearColumnas = (instalaciones: InstalacionOpcion[] | null): Column<FraccionamientoResumen>[] => [
  {
    key: 'nombre',
    header: 'Nombre',
    cell: (r) => (
      <Link href={`/admin/fraccionamientos/${r.id}`} className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {r.nombre}
      </Link>
    ),
    sortValue: (r) => r.nombre,
  },
  { key: 'slug', header: 'Slug', cell: (r) => r.slug, sortValue: (r) => r.slug, hideBelow: 'md' },
  {
    key: 'estado',
    header: 'Estado',
    cell: (r) => <StatusBadge status={r.activo ? 'Activo' : 'Inactivo'} />,
    sortValue: (r) => (r.activo ? 'Activo' : 'Inactivo'),
  },
  { key: 'usuarios', header: 'Usuarios', align: 'right', cell: (r) => r.usuarios, sortValue: (r) => r.usuarios },
  {
    key: 'domicilios',
    header: 'Domicilios',
    align: 'right',
    cell: (r) => r.domicilios,
    sortValue: (r) => r.domicilios,
  },
  {
    key: 'acciones',
    header: 'Acciones',
    align: 'right',
    cell: (r) => (
      <FraccionamientoDialog
        item={r}
        instalaciones={instalaciones}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${r.nombre}`}>
            <Pencil aria-hidden="true" />
          </Button>
        }
      />
    ),
  },
]

export function FraccionamientosTable({
  rows,
  instalaciones,
}: {
  rows: FraccionamientoResumen[]
  instalaciones: InstalacionOpcion[] | null
}) {
  return (
    <Card className="p-0">
      <DataTable
        columns={crearColumnas(instalaciones)}
        rows={rows}
        getRowKey={(r) => r.id}
        rowHref={(r) => `/admin/fraccionamientos/${r.id}`}
        entityLabel="fraccionamientos"
        emptyTitle="Aún no hay fraccionamientos."
        emptyDescription="Crea el primero con el botón Nuevo fraccionamiento."
      />
    </Card>
  )
}
