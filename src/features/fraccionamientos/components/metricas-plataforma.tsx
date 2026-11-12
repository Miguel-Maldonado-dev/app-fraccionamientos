'use client'

import { Building2, CreditCard, Home, Phone, UserCheck, Users } from 'lucide-react'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { MetricGroup } from '@/components/metric-group'
import { SectionCard } from '@/components/section-card'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { totalesPlataforma, type MetricasFraccionamiento } from '../metricas'
import { FraccionamientoDialog } from './fraccionamiento-dialog'

const num = (key: keyof MetricasFraccionamiento, header: string): Column<MetricasFraccionamiento> => ({
  key,
  header,
  align: 'right',
  cell: (r) => r[key] as number,
  sortValue: (r) => r[key] as number,
})

const columns: Column<MetricasFraccionamiento>[] = [
  {
    key: 'nombre',
    header: 'Nombre',
    cell: (r) => (
      <Link href={`/admin/fraccionamientos/${r.id}`} className="font-medium hover:underline">
        {r.nombre}
      </Link>
    ),
    sortValue: (r) => r.nombre,
  },
  {
    key: 'estado',
    header: 'Estado',
    cell: (r) => <StatusBadge status={r.activo ? 'Activo' : 'Inactivo'} />,
    sortValue: (r) => (r.activo ? 'Activo' : 'Inactivo'),
  },
  num('domicilios', 'Domicilios'),
  num('residentes', 'Residentes'),
  num('usuariosActivos', 'Usuarios activos'),
  num('tarjetas', 'Tarjetas'),
  num('telefonos', 'Teléfonos'),
]

export function MetricasPlataforma({ rows }: { rows: MetricasFraccionamiento[] }) {
  const t = totalesPlataforma(rows)
  return (
    <div className="space-y-6">
      <MetricGroup
        items={[
          { label: 'Fraccionamientos', value: `${t.activos} de ${t.fraccionamientos}`, icon: Building2 },
          { label: 'Domicilios', value: String(t.domicilios), icon: Home, tone: 'info' },
          { label: 'Residentes', value: String(t.residentes), icon: Users, tone: 'success' },
          { label: 'Usuarios activos', value: String(t.usuariosActivos), icon: UserCheck },
          { label: 'Tarjetas de acceso', value: String(t.tarjetas), icon: CreditCard, tone: 'neutral' },
          { label: 'Teléfonos de acceso', value: String(t.telefonos), icon: Phone, tone: 'neutral' },
        ]}
      />
      <SectionCard title="Por fraccionamiento" flush>
        {rows.length === 0 ? (
          <EmptyState
            title="Aún no hay fraccionamientos."
            description="Crea el primero para empezar."
            // Sin consultar access-core en el tablero: la instalación se vincula después, al editar.
            action={<FraccionamientoDialog instalaciones={[]} trigger={<Button>+ Nuevo fraccionamiento</Button>} />}
          />
        ) : (
          <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} entityLabel="fraccionamientos" />
        )}
      </SectionCard>
    </div>
  )
}
