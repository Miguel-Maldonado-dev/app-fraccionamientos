'use client'

import { Cpu, Fingerprint, House, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TODOS = '__todos__'

// Los íconos se eligen aquí por nombre: un Server Component no puede pasar componentes a uno de cliente.
const ICONOS = { domicilio: House, panel: Cpu, resultado: ShieldCheck, origen: Fingerprint }
export type IconoFiltro = keyof typeof ICONOS

/**
 * Select con el diseño de la app (como LabeledSelect) para el formulario GET de filtros:
 * el valor viaja en un input oculto con `name`, y "Todos" se envía vacío.
 */
export function SelectFiltro({
  id,
  name,
  label,
  icono,
  defaultValue,
  options,
  allLabel = 'Todos',
}: {
  id: string
  name: string
  label: string
  icono?: IconoFiltro
  defaultValue?: string
  options: { value: string; label: string }[]
  allLabel?: string
}) {
  const [valor, setValor] = useState(defaultValue ?? '')
  const Icon = icono ? ICONOS[icono] : null
  return (
    <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <input type="hidden" name={name} value={valor} />
      <Select value={valor || TODOS} onValueChange={(v) => setValor(v === TODOS ? '' : v)}>
        <SelectTrigger id={id} className="w-full">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
