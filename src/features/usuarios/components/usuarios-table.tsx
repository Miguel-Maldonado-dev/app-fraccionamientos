'use client'

import { DataTable, type Column } from '@/components/data-table'
import { PersonCell } from '@/components/person-cell'
import { StatusBadge } from '@/components/status-badge'
import { ROL_LABEL } from '@/lib/constants'
import type { ActionResult } from '@/lib/action-result'
import type { Views } from '@/lib/supabase/types'
import { UsuarioActions } from './usuario-actions'

type Row = Views<'users_info'>

/** Props opcionales para reutilizar la tabla fuera de /usuarios (p. ej. la consola del super admin). */
export type OpcionesUsuarios = {
  cambiarEstado?: (id: string, activo: boolean) => Promise<ActionResult>
  permitirEditar?: boolean
}

export function UsuariosTable({
  rows,
  currentUserId,
  cambiarEstado,
  permitirEditar = true,
}: {
  rows: Row[]
  currentUserId: string
} & OpcionesUsuarios) {
  const columns: Column<Row>[] = [
    {
      key: 'user_name',
      header: 'Nombre',
      cell: (r) => (
        <div className="flex flex-col">
          <PersonCell name={r.user_name} />
          {r.email ? <span className="pl-11 text-xs text-muted-foreground md:hidden">{r.email}</span> : null}
        </div>
      ),
      sortValue: (r) => r.user_name ?? '',
    },
    {
      key: 'email',
      header: 'Email',
      hideBelow: 'md',
      cell: (r) => r.email ?? '—',
      sortValue: (r) => r.email ?? '',
    },
    {
      key: 'rol',
      header: 'Rol',
      cell: (r) => (r.rol ? <StatusBadge status={ROL_LABEL[r.rol]} /> : '—'),
      sortValue: (r) => (r.rol ? ROL_LABEL[r.rol] : ''),
    },
    {
      key: 'estatus',
      header: 'Estatus',
      cell: (r) => <StatusBadge status={r.is_active ? 'Activo' : 'Inactivo'} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      cell: (r) => (
        <UsuarioActions
          usuario={r}
          currentUserId={currentUserId}
          cambiarEstado={cambiarEstado}
          permitirEditar={permitirEditar}
        />
      ),
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      entityLabel="usuarios"
      getRowKey={(r) => r.id ?? r.email ?? ''}
      emptyTitle="Sin usuarios"
      emptyDescription="No hay usuarios para mostrar."
    />
  )
}
