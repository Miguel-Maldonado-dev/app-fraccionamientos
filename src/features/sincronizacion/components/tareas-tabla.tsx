'use client'

import { AlertTriangle, Cable, Hash, Home, RefreshCw, Settings2 } from 'lucide-react'
import { CARD_TABLE_HEAD_ROW, CardTableHead } from '@/components/card-table-head'
import { Button } from '@/components/ui/button'
import { SyncBadge } from '@/components/sync-badge'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import type { Entidad, Operacion, Tarea } from '../tipos'

const ENTIDAD_LABEL: Record<Entidad, string> = {
  domicilio: 'Domicilio',
  tarjeta: 'Tarjeta',
  control: 'Control RF',
  pin: 'PIN',
}

const OPERACION_LABEL: Record<Operacion, string> = {
  crear: 'Alta',
  actualizar: 'Cambio',
  borrar: 'Baja',
  asignar: 'Asignar permiso',
  reconciliar: 'Ajustar medios',
  fijar: 'Fijar PIN',
  quitar: 'Quitar PIN',
}

/**
 * `modo="consola"`: el super admin no debe poder deducir quién está al corriente, así que la
 * asignación de perfil se muestra como "Actualizar acceso".
 */
export function TareasTabla({
  tareas,
  onReintentar,
  reintentando = null,
  modo = 'app',
}: {
  tareas: (Tarea & { direccion: string | null })[]
  onReintentar: (id: string) => void
  reintentando?: string | null
  modo?: 'app' | 'consola'
}) {
  const operacion = (t: Tarea) =>
    modo === 'consola' && t.operacion === 'asignar' ? 'Actualizar acceso' : (OPERACION_LABEL[t.operacion as Operacion] ?? t.operacion)
  return (
    <Table>
      <TableHeader className="[&_tr]:border-b-0">
        <TableRow className={CARD_TABLE_HEAD_ROW}>
          <CardTableHead icon={Home}>Domicilio</CardTableHead>
          <CardTableHead icon={Cable}>Medio</CardTableHead>
          <CardTableHead icon={Settings2}>Operación</CardTableHead>
          <CardTableHead icon={Hash}>Intentos</CardTableHead>
          <CardTableHead icon={RefreshCw}>Estado</CardTableHead>
          <CardTableHead icon={AlertTriangle}>Error</CardTableHead>
          <CardTableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tareas.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{t.direccion ?? '—'}</TableCell>
            <TableCell>{ENTIDAD_LABEL[t.entidad as Entidad] ?? t.entidad}</TableCell>
            <TableCell>{operacion(t)}</TableCell>
            <TableCell className="tabular-nums">{t.intentos}</TableCell>
            <TableCell>
              <SyncBadge estado={t.estado as 'pendiente' | 'error' | 'ok'} />
            </TableCell>
            <TableCell className="max-w-64">
              {t.ultimo_error && modo === 'consola' && t.operacion === 'asignar' ? (
                // El error de access-core puede nombrar el perfil (Morosos / Al corriente).
                <span className="block truncate">No se pudo actualizar el acceso</span>
              ) : t.ultimo_error ? (
                <span className="block truncate" title={t.ultimo_error}>
                  {t.ultimo_error}
                </span>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell>
              {t.estado === 'error' || t.estado === 'pendiente' ? (
                <Button variant="ghost" size="sm" onClick={() => onReintentar(t.id)} loading={reintentando === t.id}>
                  Reintentar
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
