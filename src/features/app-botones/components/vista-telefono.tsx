'use client'

import { useId, useState } from 'react'
import { ArrowRight, ChevronRight, CircleUserRound, Home, KeyRound, LayoutGrid, Lock } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { distribucion, type BotonApp } from '../schemas'
import { ESTILO_INFO } from '../estilos'
import { ICONO_INFO } from './iconos'

type BotonVista = Pick<BotonApp, 'nombre' | 'icono' | 'ancho_completo' | 'salida_id'> & {
  id: number | string
  estilo?: BotonApp['estilo']
}

const FONDO = '#F5F8FC'
const NAVY = '#071F49'
const DESHABILITADO = { fondo: '#EEF2F6', texto: '#B8C4D0' }

const PESTANAS = [
  { etiqueta: 'Inicio', Icon: LayoutGrid },
  { etiqueta: 'Domicilio', Icon: Home },
  { etiqueta: 'Accesos', Icon: KeyRound },
  { etiqueta: 'Cuenta', Icon: CircleUserRound },
]

/** Vista previa ficticia de la pantalla de inicio de la app; se redibuja con cada cambio. */
export function VistaTelefono({
  botones,
  resaltado,
  compacto = false,
}: {
  botones: BotonVista[]
  resaltado?: number | string | null
  /** Versión reducida, sin casilla de moroso (para el diálogo de edición). */
  compacto?: boolean
}) {
  const [moroso, setMoroso] = useState(false)
  const idMoroso = useId()
  const lados = distribucion(botones)

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        aria-label="Vista previa de la app"
        role="region"
        className={cn(
          'relative rounded-[2.5rem] border-[10px] border-brand-navy bg-brand-navy shadow-xl',
          compacto ? 'w-[250px]' : 'w-[300px]',
        )}
      >
        <div
          className="absolute top-0 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-brand-navy"
          aria-hidden
        />
        <div
          className={cn(
            'flex flex-col overflow-hidden rounded-[1.8rem]',
            compacto ? 'h-[440px]' : 'h-[560px]',
          )}
        >
          <div className="relative flex-1 space-y-3 overflow-y-auto px-4 pt-9 pb-4" style={{ background: FONDO }}>
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full opacity-70"
              style={{ background: 'radial-gradient(circle, #BDEFF6 0%, rgba(189,239,246,0) 70%)' }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-12 -left-12 size-36 rounded-full opacity-60"
              style={{ background: 'radial-gradient(circle, #CFE3FA 0%, rgba(207,227,250,0) 70%)' }}
            />
            <p className="relative text-xl font-extrabold" style={{ color: NAVY }}>
              Hola, Residente
            </p>
            <div className="relative flex items-center gap-2.5">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: '#E6F1FD', color: '#087BE8' }}
              >
                <Home className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-xs font-bold uppercase" style={{ color: NAVY }}>
                  Calle Ejemplo 1
                </p>
                <p className="truncate text-[11px] text-slate-500">Fraccionamiento</p>
              </div>
              <ChevronRight className="size-4 text-slate-400" aria-hidden />
            </div>
            {botones.length === 0 ? (
              <p className="relative rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Aquí aparecerán los botones
              </p>
            ) : (
              <div className="relative grid grid-cols-2 gap-2.5">
                {botones.map((b, i) => {
                  const { Icon } = ICONO_INFO[b.icono]
                  const deshabilitado = moroso || !b.salida_id
                  const completo = lados[i] === 'completo'
                  const e = ESTILO_INFO[b.estilo ?? 'azul_claro']
                  const fondo = deshabilitado
                    ? DESHABILITADO.fondo
                    : e.degradado
                      ? `linear-gradient(135deg, ${e.degradado[0]}, ${e.degradado[1]})`
                      : e.fondo
                  const colorTitulo = deshabilitado ? DESHABILITADO.texto : e.titulo
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={deshabilitado}
                      tabIndex={-1}
                      style={{ background: fondo, color: colorTitulo }}
                      className={cn(
                        'flex gap-2 rounded-2xl p-3 text-left transition-all motion-reduce:transition-none',
                        completo ? 'col-span-2 min-h-14 flex-row items-center' : 'min-h-24 flex-col justify-between',
                        !deshabilitado && 'shadow-sm',
                        resaltado === b.id && 'ring-2 ring-warning ring-offset-2 ring-offset-background',
                      )}
                    >
                      <Icon
                        className="size-6 shrink-0"
                        style={{ color: deshabilitado ? DESHABILITADO.texto : e.icono }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'flex min-w-0 items-center gap-1',
                          completo ? 'flex-1 justify-between' : 'w-full justify-between',
                        )}
                      >
                        <span
                          className={cn(
                            'line-clamp-2 font-bold break-words',
                            completo ? 'text-base' : 'text-xs',
                          )}
                        >
                          {b.nombre || 'Sin nombre'}
                        </span>
                        <span
                          data-chip
                          className="flex size-6 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: deshabilitado ? '#E3E9EF' : e.chip,
                            color: deshabilitado ? DESHABILITADO.texto : e.flecha,
                          }}
                        >
                          <ArrowRight className="size-3.5" aria-hidden />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <div
              className="relative flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 shadow-sm"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                style={{ background: '#E6F1FD', color: '#087BE8' }}
              >
                <Lock className="size-4" aria-hidden />
              </span>
              <div className="flex-1 leading-tight">
                <p className="text-[10px] text-slate-500">PIN de acceso</p>
                <p className="text-sm font-bold tracking-widest" style={{ color: NAVY }}>
                  ••••
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold',
                  moroso ? 'bg-danger-light text-danger-foreground' : 'bg-success-light text-success-foreground',
                )}
              >
                {moroso ? 'Moroso' : 'Al corriente'}
              </span>
            </div>
          </div>
          <nav className="grid grid-cols-4 border-t border-border bg-card py-2" aria-label="Pestañas de la app">
            {PESTANAS.map(({ etiqueta, Icon }, i) => (
              <span
                key={etiqueta}
                className={cn(
                  'flex flex-col items-center gap-0.5 text-[10px]',
                  i === 0 ? 'font-semibold text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {etiqueta}
              </span>
            ))}
          </nav>
        </div>
      </div>
      {!compacto && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox id={idMoroso} checked={moroso} onCheckedChange={(v) => setMoroso(v === true)} />
            <Label htmlFor={idMoroso} className="text-sm">
              Ver como moroso
            </Label>
          </div>
          <p className="max-w-[300px] text-center text-xs text-muted-foreground">
            Vista previa ficticia. Los botones sin salida aparecen en gris.
          </p>
        </>
      )}
    </div>
  )
}
