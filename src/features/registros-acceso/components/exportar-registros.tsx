'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { descargar } from '@/lib/download'
import { paginaExport, type MetaExport } from '../actions'
import type { Filtros } from '../filtros'
import { MSG_ERROR_EXPORTAR, MSG_SIN_REGISTROS_EXPORTAR } from '../messages'
import type { FilaRegistro } from '../traduccion'

type Formato = 'xlsx' | 'pdf'

const POR_PAGINA = 50
const MAX_PAGINAS = 100
const TOPE = POR_PAGINA * MAX_PAGINAS
const NUM = new Intl.NumberFormat('en-US')

/**
 * Exporta todos los registros de los filtros activos (tope 5,000): pide las páginas una por una al
 * servidor y genera el archivo en el navegador. exceljs/jsPDF se cargan solo al exportar.
 */
export function ExportarRegistros({
  fraccionamientoId,
  filtros,
  total,
  descripcionFiltros,
}: {
  fraccionamientoId: number | null
  filtros: Filtros
  total: number
  descripcionFiltros: string[]
}) {
  const [progreso, setProgreso] = useState<{ actual: number; de: number } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<Formato | null>(null)
  const paginas = Math.min(Math.ceil(total / POR_PAGINA), MAX_PAGINAS)

  function elegir(formato: Formato) {
    setAviso(null)
    if (total <= 0) return setAviso(MSG_SIN_REGISTROS_EXPORTAR)
    if (total > TOPE) return setPendiente(formato)
    void exportar(formato)
  }

  async function exportar(formato: Formato) {
    setPendiente(null)
    setProgreso({ actual: 0, de: paginas })
    try {
      const filas: FilaRegistro[] = []
      let meta: MetaExport | undefined
      let totalReal = total
      // Secuencial a propósito: no saturar access-core (límite de consultas).
      let limite = paginas
      for (let p = 1; p <= limite; p++) {
        setProgreso({ actual: p, de: limite })
        const r = await paginaExport(fraccionamientoId, filtros, p)
        if (!r.ok) throw new Error(r.error)
        if (p === 1) {
          meta = r.meta
          totalReal = r.total
          // El total pudo cambiar desde que se pintó la pantalla: manda el de la primera página.
          limite = Math.min(r.paginas, MAX_PAGINAS)
        }
        filas.push(...r.filas)
      }
      // Llegan registros nuevos entre páginas y recorren el orden: se quitan duplicados por id.
      const vistos = new Set<number>()
      const unicas = filas.filter((f) => !vistos.has(f.id) && vistos.add(f.id))
      if (unicas.length === 0) return setAviso(MSG_SIN_REGISTROS_EXPORTAR)
      const { cargarLogo, generarExcel, generarPdf, nombreArchivo } = await import('../export/generar')
      const datos = {
        fraccionamiento: meta?.fraccionamiento ?? 'Fraccionamiento',
        desde: filtros.desde,
        hasta: filtros.hasta,
        filtros: descripcionFiltros,
        generadoPor: meta?.generadoPor ?? '—',
        generadoEn: meta?.generadoEn ?? new Date().toLocaleString('es-MX'),
        total: totalReal,
        exportados: unicas.length,
      }
      const blob =
        formato === 'xlsx' ? await generarExcel(unicas, datos) : await generarPdf(unicas, { ...datos, logo: await cargarLogo() })
      descargar(blob, nombreArchivo(datos, formato))
    } catch {
      setAviso(MSG_ERROR_EXPORTAR)
    } finally {
      setProgreso(null)
    }
  }

  const ocupado = progreso != null
  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" disabled={ocupado} loading={ocupado}>
            {ocupado ? null : <Download />}
            {ocupado ? 'Exportando…' : 'Exportar'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => elegir('xlsx')}>
            <FileSpreadsheet aria-hidden="true" />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => elegir('pdf')}>
            <FileText aria-hidden="true" />
            PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p role="status" aria-live="polite" className="text-[13px] text-muted-foreground tabular-nums">
        {progreso && progreso.actual > 0 ? `Exportando… ${progreso.actual} de ${progreso.de}` : null}
      </p>
      {aviso ? (
        <p role="alert" className="text-[13px] text-danger-foreground">
          {aviso}
        </p>
      ) : null}
      <AlertDialog open={pendiente != null} onOpenChange={(o) => (o ? null : setPendiente(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exportar registros</AlertDialogTitle>
            <AlertDialogDescription>
              Se exportarán los primeros 5,000 de {NUM.format(total)} registros; reduce el rango para obtener todos
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendiente && void exportar(pendiente)}>Exportar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
