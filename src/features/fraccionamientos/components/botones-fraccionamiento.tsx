'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionResult } from '@/lib/action-result'
import type { SalidaOpcion } from '../access-core'
import type { BotonConfig } from '../queries'

const NINGUNA = '__ninguna__'
const BOTONES = [0, 1, 2, 3] as const

const claveDe = (s: { panelId: string; salida: number }) => `${s.panelId}:${s.salida}`
const etiquetaDe = (s: { panelCodigo: string; alias: string }) => (s.alias ? `${s.panelCodigo} · ${s.alias}` : s.panelCodigo)

function aOpcion(b: BotonConfig): SalidaOpcion {
  return { panelId: b.panelId, panelCodigo: b.panelCodigo, salida: b.salida, alias: b.salidaAlias }
}

export function BotonesFraccionamiento({
  salidas,
  botones,
  guardar,
}: {
  /** Salidas de la instalación; `null` si la API no respondió. */
  salidas: SalidaOpcion[] | null
  botones: BotonConfig[]
  guardar: (botones: BotonConfig[]) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [elegidas, setElegidas] = useState<Record<number, string>>(() =>
    Object.fromEntries(botones.map((b) => [b.boton, claveDe(b)])),
  )

  // Una salida guardada que ya no existe en la instalación se conserva como opción, para no perderla en silencio.
  const opciones = [...(salidas ?? [])]
  for (const b of botones) if (!opciones.some((o) => claveDe(o) === claveDe(b))) opciones.push(aOpcion(b))

  async function onGuardar() {
    const lista: BotonConfig[] = []
    for (const boton of BOTONES) {
      const op = opciones.find((o) => claveDe(o) === elegidas[boton])
      if (op) lista.push({ boton, panelId: op.panelId, panelCodigo: op.panelCodigo, salida: op.salida, salidaAlias: op.alias })
    }
    setGuardando(true)
    try {
      const result = await guardar(lista)
      if (result.ok) {
        toast.success('Botones guardados')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {BOTONES.map((boton) => (
          <div key={boton} className="flex flex-col gap-1.5">
            <Label htmlFor={`boton-${boton}`} className="text-xs font-medium">
              Botón {boton + 1}
            </Label>
            <Select
              value={elegidas[boton] ?? NINGUNA}
              disabled={salidas === null}
              onValueChange={(v) => setElegidas((prev) => ({ ...prev, [boton]: v }))}
            >
              <SelectTrigger id={`boton-${boton}`} className="w-full" aria-label={`Botón ${boton + 1}`}>
                <SelectValue placeholder="Ninguna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNA}>Ninguna</SelectItem>
                {opciones.map((o) => (
                  <SelectItem key={claveDe(o)} value={claveDe(o)}>
                    {etiquetaDe(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {salidas === null && <p className="text-xs text-danger-foreground">No se pudo consultar access-core</p>}
      <Button type="button" onClick={onGuardar} loading={guardando} disabled={salidas === null}>
        Guardar botones
      </Button>
    </div>
  )
}
