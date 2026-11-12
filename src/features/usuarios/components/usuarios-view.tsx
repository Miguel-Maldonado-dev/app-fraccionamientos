'use client'

import { Users } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { FilterBar } from '@/components/filter-bar'
import { LabeledSelect } from '@/components/labeled-select'
import { SearchInput } from '@/components/search-input'
import { Card } from '@/components/ui/card'
import { matches } from '@/lib/search'
import type { Views } from '@/lib/supabase/types'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { UsuariosTable, type OpcionesUsuarios } from './usuarios-table'

const ESTADO_OPTIONS = [
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
]

export function UsuariosView({
  rows,
  currentUserId,
  estado,
  cambiarEstado,
  permitirEditar = true,
}: {
  rows: Views<'users_info'>[]
  currentUserId: string
  estado: 'activos' | 'inactivos'
} & OpcionesUsuarios) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Conserva los demás parámetros (p. ej. `tab` en la consola): solo `estado` cambia.
  const irA = (estadoNuevo: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (estadoNuevo === null) params.delete('estado')
    else params.set('estado', estadoNuevo)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const filtradas = useMemo(
    () => rows.filter((r) => matches([r.user_name, r.email], debouncedQuery)),
    [rows, debouncedQuery],
  )

  return (
    <div className="space-y-6">
      <FilterBar
        onClear={() => {
          setQuery('')
          irA(null)
        }}
      >
        <SearchInput id="usr-q" value={query} onChange={setQuery} placeholder="Buscar por nombre o email..." />
        <LabeledSelect
          id="usr-estado"
          label="Estado"
          icon={Users}
          options={ESTADO_OPTIONS}
          value={estado}
          onChange={(v) => irA(v ?? 'activos')}
        />
      </FilterBar>
      <Card className="p-0">
        <UsuariosTable
          rows={filtradas}
          currentUserId={currentUserId}
          cambiarEstado={cambiarEstado}
          permitirEditar={permitirEditar}
        />
      </Card>
    </div>
  )
}
