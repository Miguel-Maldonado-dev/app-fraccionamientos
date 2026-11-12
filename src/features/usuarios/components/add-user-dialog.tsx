'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionResult } from '@/lib/action-result'
import { ROL_LABEL, ROLES_FRACCIONAMIENTO } from '@/lib/constants'
import { crearUsuario } from '../actions'
import { MSG_USUARIO_CREADO } from '../messages'
import { nuevoUsuarioSchema, type NuevoUsuarioInput } from '../schemas'

const FORM_ID = 'add-user-form'

const EMPTY = {
  userName: '',
  email: '',
  password: '',
  rol: undefined as unknown as NuevoUsuarioInput['rol'],
}

/** `crear` permite usar otra Server Action (p. ej. la de la consola); por defecto, `crearUsuario`. */
export function AddUserDialog({
  crear = crearUsuario,
}: {
  crear?: (input: NuevoUsuarioInput) => Promise<ActionResult>
} = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NuevoUsuarioInput>({
    resolver: zodResolver(nuevoUsuarioSchema),
    defaultValues: EMPTY,
  })

  async function onSubmit(values: NuevoUsuarioInput) {
    try {
      const result = await crear(values)
      if (result.ok) {
        toast.success(MSG_USUARIO_CREADO)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Ocurrió un error inesperado. Intenta de nuevo.')
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return
    if (next) {
      reset(EMPTY)
      setShowPassword(false)
    }
    setOpen(next)
  }

  return (
    <FormDialog
      title="Nuevo usuario"
      description="Crea una cuenta de acceso al sistema y asígnale un rol."
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button>
          <Plus /> Nuevo usuario
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            Crear
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={handleSubmit(onSubmit, () => toast.error('Por favor, ingresa todos los datos obligatorios. (*)'))}
        className="grid gap-4 md:grid-cols-2"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="userName" className="text-xs font-medium">
            Nombre <span className="text-danger-foreground">*</span>
          </Label>
          <Input id="userName" {...register('userName')} />
          {errors.userName && <p className="text-xs text-danger-foreground">{errors.userName.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs font-medium">
            Email <span className="text-danger-foreground">*</span>
          </Label>
          <Input id="email" type="email" autoComplete="off" {...register('email')} />
          {errors.email && <p className="text-xs text-danger-foreground">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs font-medium">
            Contraseña <span className="text-danger-foreground">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {errors.password && <p className="text-xs text-danger-foreground">{errors.password.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rol" className="text-xs font-medium">
            Rol de Usuario <span className="text-danger-foreground">*</span>
          </Label>
          <Controller
            control={control}
            name="rol"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v)}>
                <SelectTrigger id="rol" className="w-full">
                  <SelectValue placeholder="Seleccionar rol..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_FRACCIONAMIENTO.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROL_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.rol && <p className="text-xs text-danger-foreground">Selecciona un rol</p>}
        </div>
      </form>
    </FormDialog>
  )
}
