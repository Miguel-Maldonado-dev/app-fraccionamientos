'use client'

import { SyncBadge } from '@/components/sync-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <TableHeader>
        <TableRow>
          <TableHead>Domicilio</TableHead>
          <TableHead>Medio</TableHead>
          <TableHead>Operación</TableHead>
          <TableHead>Intentos</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Error</TableHead>
          <TableHead className="w-0" />
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
