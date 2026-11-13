'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Tables } from '@/lib/supabase/types'
import { darAccesoApp, restablecerPasswordResidente } from '../cuentas-actions'
import {
  MSG_ACCESO_APP_DADO,
  MSG_CUENTA_VINCULADA,
  MSG_PASSWORD_CORTA,
  MSG_PASSWORD_RESTABLECIDA,
  MSG_TELEFONO_INVALIDO,
} from '../messages'
import { normalizarTelefono } from '../telefono'

const FORM_ID = 'acceso-app-form'

/**
 * `dar`: pide teléfono y contraseña (esta se ignora si el teléfono ya tiene cuenta).
 * `restablecer`: solo pide la nueva contraseña.
 */
export function AccesoAppDialog({
  residente,
  modo,
  trigger,
}: {
  residente: Tables<'residentes'>
  modo: 'dar' | 'restablecer'
  trigger: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [telefono, setTelefono] = useState(residente.telefono ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const dar = modo === 'dar'

  function handleOpenChange(next: boolean) {
    if (next) {
      setTelefono(residente.telefono ?? '')
      setPassword('')
      setError(null)
    }
    setOpen(next)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (dar && normalizarTelefono(telefono) === null) return setError(MSG_TELEFONO_INVALIDO)
    if (!dar && password.length < 8) return setError(MSG_PASSWORD_CORTA)
    if (dar && password !== '' && password.length < 8) return setError(MSG_PASSWORD_CORTA)
    setError(null)
    setEnviando(true)
    try {
      const result = dar
        ? await darAccesoApp(residente.id, { telefono, password: password || undefined })
        : await restablecerPasswordResidente(residente.id, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (dar) {
        const data = result.data as { cuentaCreada: boolean }
        toast.success(data.cuentaCreada ? MSG_ACCESO_APP_DADO : MSG_CUENTA_VINCULADA)
      } else {
        toast.success(MSG_PASSWORD_RESTABLECIDA)
      }
      setOpen(false)
      router.refresh()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <FormDialog
      title={dar ? 'Dar acceso a la app' : 'Restablecer contraseña'}
      description={
        dar
          ? `Crea o vincula la cuenta de ${residente.nombre}. Si el teléfono ya tiene cuenta, se vincula y la contraseña se ignora.`
          : `Define una nueva contraseña para ${residente.nombre}.`
      }
      trigger={trigger}
      open={open}
      onOpenChange={handleOpenChange}
      footer={
        <>
          <Button variant="secondary" type="button" disabled={enviando} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={enviando}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="grid gap-4" noValidate>
        {dar && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acceso-telefono" className="text-xs font-medium">
              Teléfono
            </Label>
            <Input
              id="acceso-telefono"
              inputMode="numeric"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acceso-password" className="text-xs font-medium">
            Contraseña
          </Label>
          <Input
            id="acceso-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-secondary-foreground">Mínimo 8 caracteres.</p>
        </div>
        {error && <p className="text-xs text-danger-foreground">{error}</p>}
      </form>
    </FormDialog>
  )
}
