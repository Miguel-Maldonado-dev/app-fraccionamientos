import { cache } from 'react'
import { ROLES, SUPER_ADMIN, type Rol, type RoleName } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

export type Perfil = {
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  fraccionamientoId: number | null
}

export type TenantContext = {
  userId: string
  email: string
  perfil: Perfil | null
  fraccionamiento: { id: number; nombre: string } | null
}

export type EstadoAcceso = 'app' | 'super_admin' | 'sin_acceso'

export type CurrentUser = {
  id: string
  email: string
  userName: string
  roleName: RoleName | null
  isActive: boolean
  fraccionamientoId: number | null
}

const ROLE_NAMES: readonly string[] = Object.values(ROLES)

function isRoleName(value: string): value is RoleName {
  return ROLE_NAMES.includes(value)
}

/**
 * A dónde puede entrar el usuario. Un fraccionamiento inactivo llega como `null` porque RLS
 * lo oculta a sus miembros, así que basta con revisar que exista.
 */
export function estadoAcceso(ctx: TenantContext): EstadoAcceso {
  const { perfil } = ctx
  if (!perfil || !perfil.activo) return 'sin_acceso'
  if (perfil.rol === SUPER_ADMIN) return 'super_admin'
  if (isRoleName(perfil.rol) && ctx.fraccionamiento) return 'app'
  return 'sin_acceso'
}

/** Sesión, perfil y fraccionamiento del usuario; una sola lectura por petición gracias a `cache`. */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const claims = auth?.claims
  if (!claims) return null

  // El propio perfil siempre es visible, aunque esté inactivo.
  const { data: row, error } = await supabase
    .from('perfiles')
    .select('nombre, email, rol, activo, fraccionamiento_id')
    .eq('id', claims.sub)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`)

  const email = claims.email ?? row?.email ?? ''
  if (!row) return { userId: claims.sub, email, perfil: null, fraccionamiento: null }

  const perfil: Perfil = {
    nombre: row.nombre,
    email: row.email,
    rol: row.rol,
    activo: row.activo,
    fraccionamientoId: row.fraccionamiento_id,
  }

  let fraccionamiento: TenantContext['fraccionamiento'] = null
  if (row.fraccionamiento_id !== null) {
    const { data, error: fError } = await supabase
      .from('fraccionamientos')
      .select('id, nombre')
      .eq('id', row.fraccionamiento_id)
      .maybeSingle()
    if (fError) throw new Error(`No se pudo leer el fraccionamiento: ${fError.message}`)
    fraccionamiento = data
  }

  return { userId: claims.sub, email, perfil, fraccionamiento }
})

/**
 * Vista del contexto para la app de fraccionamiento. `isActive` solo es verdadero con acceso
 * a la app: el super admin queda inactivo aquí porque sus acciones viven en `/admin`.
 */
export function toCurrentUser(ctx: TenantContext): CurrentUser {
  const { perfil } = ctx
  return {
    id: ctx.userId,
    email: ctx.email,
    userName: perfil?.nombre ?? '',
    roleName: perfil && isRoleName(perfil.rol) ? perfil.rol : null,
    isActive: estadoAcceso(ctx) === 'app',
    fraccionamientoId: perfil?.fraccionamientoId ?? null,
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const ctx = await getTenantContext()
  return ctx ? toCurrentUser(ctx) : null
}
