import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FilaRegistro } from '../traduccion'

const COLUMNAS = ['Fecha y hora', 'Panel', 'Domicilio / Titular', 'Origen', 'Credencial', 'Salida', 'Resultado', 'Motivo']
const NUM = new Intl.NumberFormat('en-US')
const POR_PAGINA = 50

/** Páginas visibles: 1, última y actual ±2; `null` marca un hueco (igual que DataTable). */
function ventana(actual: number, total: number): (number | null)[] {
  const res: (number | null)[] = []
  let prev = 0
  for (let p = 1; p <= total; p++) {
    if (p !== 1 && p !== total && Math.abs(p - actual) > 2) continue
    if (p - prev > 1) res.push(null)
    res.push(p)
    prev = p
  }
  return res
}

function Paginador({
  href,
  deshabilitado,
  label,
  actual,
  children,
}: {
  href: string
  deshabilitado?: boolean
  label: string
  actual?: boolean
  children: React.ReactNode
}) {
  if (deshabilitado) {
    return (
      <Button variant="secondary" size="icon-sm" disabled aria-label={label}>
        {children}
      </Button>
    )
  }
  return (
    <Button asChild variant={actual ? 'default' : 'secondary'} size="icon-sm">
      <Link href={href} aria-label={label} aria-current={actual ? 'page' : undefined}>
        {children}
      </Link>
    </Button>
  )
}

/** Tabla paginada en servidor; `hrefPagina(n)` arma la URL de la página `n` conservando los filtros. */
export function RegistrosTabla({
  filas,
  total,
  pagina,
  paginas,
  hrefPagina,
}: {
  filas: FilaRegistro[]
  total: number
  pagina: number
  paginas: number
  hrefPagina: (n: number) => string
}) {
  if (total === 0) {
    return <EmptyState title="Sin registros" description="No hay registros con estos filtros." />
  }
  const ultima = Math.max(1, paginas)
  return (
    <div>
      <div className="overflow-x-auto">
        <Table className="text-[11px]">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {COLUMNAS.map((c) => (
                <TableHead key={c} className="text-xs">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS.length} className="py-10 text-center text-sm text-muted-foreground">
                  Esta página no tiene registros. Vuelve a una página anterior.
                </TableCell>
              </TableRow>
            ) : null}
            {filas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap tabular-nums">{f.fechaHora}</TableCell>
                <TableCell>{f.panel}</TableCell>
                <TableCell className="font-medium">{f.titular}</TableCell>
                <TableCell>{f.origen}</TableCell>
                <TableCell>{f.credencial}</TableCell>
                <TableCell>{f.salida}</TableCell>
                <TableCell>
                  <Badge variant={f.permitido ? 'success' : 'danger'} dot className="text-[10px]">
                    {f.resultado}
                  </Badge>
                </TableCell>
                <TableCell>{f.motivo}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
        <p className="text-[13px] text-muted-foreground">
          {filas.length > 0
            ? `Mostrando ${NUM.format((pagina - 1) * POR_PAGINA + 1)} a ${NUM.format((pagina - 1) * POR_PAGINA + filas.length)} de ${NUM.format(total)} registros`
            : `${NUM.format(total)} ${total === 1 ? 'registro' : 'registros'}`}
        </p>
        <nav aria-label="Paginación" className="flex items-center gap-1">
          <Paginador href={hrefPagina(1)} deshabilitado={pagina <= 1} label="Primera página">
            <ChevronsLeft />
          </Paginador>
          <Paginador href={hrefPagina(Math.min(pagina - 1, ultima))} deshabilitado={pagina <= 1} label="Página anterior">
            <ChevronLeft />
          </Paginador>
          {ventana(Math.min(pagina, ultima), ultima).map((p, i) =>
            p === null ? (
              <span key={`hueco-${i}`} aria-hidden="true" className="px-1 text-[13px] text-muted-foreground">
                …
              </span>
            ) : (
              <Paginador key={p} href={hrefPagina(p)} label={`Página ${p}`} actual={p === pagina}>
                {p}
              </Paginador>
            ),
          )}
          <Paginador href={hrefPagina(pagina + 1)} deshabilitado={pagina >= ultima} label="Página siguiente">
            <ChevronRight />
          </Paginador>
          <Paginador href={hrefPagina(ultima)} deshabilitado={pagina >= ultima} label="Última página">
            <ChevronsRight />
          </Paginador>
        </nav>
      </div>
    </div>
  )
}
