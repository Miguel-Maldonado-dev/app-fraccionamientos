import Link from 'next/link'
import { FilterX, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Filtros } from '../filtros'
import type { OpcionesRegistros } from '../actions'
import { ORIGENES } from '../traduccion'
import { SelectFiltro } from './select-filtro'


function Campo({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

/**
 * Barra de filtros como formulario GET: al aplicar, la URL cambia y la página vuelve a consultar.
 * `fijos` son parámetros que se conservan (p. ej. `tab`, `vista`); `exportar` es el hueco para la exportación.
 */
export function RegistrosFiltros({
  filtros,
  opciones,
  basePath,
  fijos = {},
  error,
  exportar,
}: {
  filtros: Filtros
  opciones: OpcionesRegistros
  basePath: string
  fijos?: Record<string, string>
  error?: string | null
  exportar?: ReactNode
}) {
  const limpiar = Object.keys(fijos).length ? `${basePath}?${new URLSearchParams(fijos)}` : basePath
  return (
    <Card className="gap-3 p-4">
      <form method="get" action={basePath} className="flex flex-row flex-wrap items-end gap-3" aria-label="Filtros de registros">
        {Object.entries(fijos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Campo id="reg-desde" label="Desde">
          <Input id="reg-desde" name="desde" type="date" defaultValue={filtros.desde} required />
        </Campo>
        <Campo id="reg-hasta" label="Hasta">
          <Input id="reg-hasta" name="hasta" type="date" defaultValue={filtros.hasta} required />
        </Campo>
        <SelectFiltro
          id="reg-domicilio"
          name="domicilio"
          label="Domicilio"
          icono="domicilio"
          defaultValue={filtros.domicilio != null ? String(filtros.domicilio) : ''}
          options={opciones.domicilios.map((d) => ({ value: String(d.id), label: d.direccion }))}
        />
        <SelectFiltro
          id="reg-panel"
          name="panel"
          label="Panel"
          icono="panel"
          defaultValue={filtros.panel ?? ''}
          options={opciones.paneles.map((p) => ({ value: p.id, label: p.panel_code }))}
        />
        <SelectFiltro
          id="reg-resultado"
          name="resultado"
          label="Resultado"
          icono="resultado"
          defaultValue={filtros.resultado ?? ''}
          options={[
            { value: 'permitido', label: 'Permitido' },
            { value: 'denegado', label: 'Denegado' },
          ]}
        />
        <SelectFiltro
          id="reg-origen"
          name="origen"
          label="Origen"
          icono="origen"
          defaultValue={filtros.origen ?? ''}
          options={Object.entries(ORIGENES).map(([v, t]) => ({ value: v, label: t }))}
        />
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <Button type="submit" size="sm">
            <Search /> Aplicar
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={limpiar}>
              <FilterX /> Limpiar
            </Link>
          </Button>
          {exportar}
        </div>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  )
}
