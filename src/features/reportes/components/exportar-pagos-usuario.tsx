'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { todayISO } from '@/lib/dates'
import { descargar } from '@/lib/download'
import { cargarLogo } from '@/lib/logo-pdf'
import type { Views } from '@/lib/supabase/types'
import { totalImporte } from '../totals'

type Formato = 'xlsx' | 'pdf'

const MIME: Record<Formato, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

/** Exporta las filas del reporte (ya filtradas). Las librerías de Excel y PDF se cargan solo al exportar. */
export function ExportarPagosUsuario({
  rows,
  fraccionamiento,
  usuario,
  inicio,
  fin,
  metodo,
}: {
  rows: Views<'reporte_pagos_detalle'>[]
  fraccionamiento: string
  usuario: string
  inicio: string
  fin: string
  metodo: string
}) {
  const [generando, setGenerando] = useState(false)

  async function exportar(formato: Formato) {
    setGenerando(true)
    try {
      const { crearExcelPagos, crearPdfPagos } = await import('../export/generar')
      const filas = rows.map((r) => ({
        referencia: r.referencia ?? '—',
        usuario: r.nombre_usuario ?? '—',
        metodo: r.metodo_pago_nombre ?? '—',
        importe: r.importe ?? 0,
        fecha: r.fecha_pago ?? '',
      }))
      const hoy = todayISO()
      const meta = { fraccionamiento, usuario, inicio, fin, metodo, generado: hoy, total: totalImporte(rows) }
      const contenido =
        formato === 'xlsx'
          ? await crearExcelPagos(filas, meta)
          : crearPdfPagos(filas, meta, await cargarLogo())
      descargar(new Blob([contenido], { type: MIME[formato] }), `pagos-usuario-${inicio}_${fin}.${formato}`)
    } catch {
      toast.error('No se pudo generar el archivo. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" disabled={rows.length === 0} loading={generando}>
          {generando ? null : <Download />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={() => exportar('xlsx')}>
          <FileSpreadsheet aria-hidden="true" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportar('pdf')}>
          <FileText aria-hidden="true" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
