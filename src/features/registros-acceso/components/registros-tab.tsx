import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { todayISO } from '@/lib/dates'
import { consultarRegistros, opcionesRegistros, type OpcionesRegistros } from '../actions'
import { filtrosAParams, leerFiltros, type Filtros } from '../filtros'
import { ORIGENES } from '../traduccion'
import { ExportarRegistros } from './exportar-registros'
import { RegistrosFiltros } from './registros-filtros'
import { RegistrosError } from './registros-reintentar'
import { RegistrosTabla } from './registros-tabla'

/** Filtros activos en texto, para el encabezado de la exportación. */
function describirFiltros(f: Filtros, o: OpcionesRegistros): string[] {
  const partes: string[] = []
  if (f.domicilio != null) partes.push(`Domicilio: ${o.domicilios.find((d) => d.id === f.domicilio)?.direccion ?? f.domicilio}`)
  if (f.panel) partes.push(`Panel: ${o.paneles.find((p) => p.id === f.panel)?.panel_code ?? f.panel}`)
  if (f.resultado) partes.push(`Resultado: ${f.resultado === 'permitido' ? 'Permitido' : 'Denegado'}`)
  if (f.origen) partes.push(`Origen: ${ORIGENES[Number(f.origen) as keyof typeof ORIGENES]}`)
  return partes
}

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Registros de acceso (server component). `fraccionamientoId`: `null` para el administrador (su
 * fraccionamiento); el id solo en la consola del super admin. `fijos` se conservan en la URL.
 * `exportar` reemplaza el botón de exportación por omisión (`ExportarRegistros`).
 */
export async function RegistrosTab({
  fraccionamientoId,
  searchParams,
  basePath,
  fijos = {},
  exportar,
}: {
  fraccionamientoId: number | null
  searchParams: SearchParams
  basePath: string
  fijos?: Record<string, string>
  exportar?: ReactNode
}) {
  const { filtros, error } = leerFiltros(searchParams, todayISO())
  // Solo se consulta access-core cuando el usuario aplicó filtros (la URL trae `desde`) y son válidos;
  // al entrar a la pestaña o tras "Limpiar" no se hace ninguna consulta de registros.
  const aplicado = searchParams.desde !== undefined && !error
  const [resultado, opciones] = await Promise.all([
    aplicado ? consultarRegistros(fraccionamientoId, filtros) : null,
    opcionesRegistros(fraccionamientoId),
  ])

  const hrefPagina = (n: number) => {
    const p = filtrosAParams({ ...filtros, pagina: n })
    const q = new URLSearchParams(fijos)
    p.forEach((v, k) => q.set(k, v))
    return `${basePath}?${q}`
  }

  return (
    <div className="space-y-4">
      <RegistrosFiltros
        filtros={filtros}
        opciones={opciones}
        basePath={basePath}
        fijos={fijos}
        error={error}
        exportar={
          exportar ??
          (resultado?.ok ? (
            <ExportarRegistros
              fraccionamientoId={fraccionamientoId}
              filtros={filtros}
              total={resultado.total}
              descripcionFiltros={describirFiltros(filtros, opciones)}
            />
          ) : null)
        }
      />
      <Card className="overflow-hidden p-0">
        {resultado === null ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Configura los filtros y presiona <span className="font-medium text-foreground">Aplicar</span> para consultar
            los registros.
          </p>
        ) : resultado.ok ? (
          <RegistrosTabla
            filas={resultado.filas}
            total={resultado.total}
            pagina={resultado.pagina}
            paginas={resultado.paginas}
            hrefPagina={hrefPagina}
          />
        ) : resultado.sinInstalacion ? (
          <p className="px-6 py-12 text-center text-sm text-secondary-foreground">{resultado.error}</p>
        ) : (
          <RegistrosError mensaje={resultado.error} />
        )}
      </Card>
    </div>
  )
}
