'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/action-result'
import { MSG_MAX_APP_GUARDADO } from '../messages'
import { maxResidentesAppSchema } from '../schemas'

/** Máximo de residentes con acceso a la app por domicilio. */
export function AppResidentesForm({
  maximo,
  guardar,
}: {
  maximo: number
  guardar: (valor: number) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(String(maximo))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function onGuardar() {
    const parsed = maxResidentesAppSchema.safeParse(texto.trim() === '' ? Number.NaN : Number(texto))
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const result = await guardar(parsed.data)
      if (result.ok) {
        toast.success(MSG_MAX_APP_GUARDADO)
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="max-residentes-app">Residentes con acceso a la app por domicilio</Label>
        <Input
          id="max-residentes-app"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <p className="text-xs text-secondary-foreground">
          Del 1 al 20. Bajar el máximo no quita el acceso a quien ya lo tiene.
        </p>
        {error && <p className="text-xs text-danger-foreground">{error}</p>}
      </div>
      <Button onClick={onGuardar} loading={guardando}>
        Guardar
      </Button>
    </div>
  )
}
