'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { MEDIO_LABEL, MEDIOS_ACCESO, MEDIOS_HABILITABLES, type MedioAcceso } from '@/lib/constants'
import type { ActionResult } from '@/lib/action-result'

export function MediosFraccionamiento({
  habilitados,
  guardar,
}: {
  habilitados: MedioAcceso[]
  guardar: (medios: MedioAcceso[]) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [medios, setMedios] = useState<MedioAcceso[]>(habilitados)
  const [guardando, setGuardando] = useState(false)

  const cambio = medios.length !== habilitados.length || medios.some((m) => !habilitados.includes(m))

  function alternar(medio: MedioAcceso, marcado: boolean) {
    setMedios((prev) => (marcado ? [...prev, medio] : prev.filter((m) => m !== medio)))
  }

  async function onGuardar() {
    setGuardando(true)
    try {
      // Se manda en el orden del catálogo para que el resultado no dependa del orden de los clics.
      const result = await guardar(MEDIOS_ACCESO.filter((m) => medios.includes(m)))
      if (result.ok) {
        toast.success('Medios guardados')
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
      <ul className="grid gap-3 sm:grid-cols-2">
        {MEDIOS_ACCESO.map((medio) => {
          const disponible = MEDIOS_HABILITABLES.includes(medio)
          const id = `medio-${medio}`
          return (
            <li key={medio} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={medios.includes(medio)}
                disabled={!disponible}
                onCheckedChange={(v) => alternar(medio, v === true)}
              />
              <Label htmlFor={id}>{MEDIO_LABEL[medio]}</Label>
              {!disponible && <span className="text-xs text-secondary-foreground">Próximamente</span>}
            </li>
          )
        })}
      </ul>
      <Button type="button" onClick={onGuardar} loading={guardando} disabled={!cambio}>
        Guardar medios
      </Button>
    </div>
  )
}
