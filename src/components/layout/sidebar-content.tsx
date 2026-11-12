import { LogOut } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { logout } from '@/features/auth/actions'
import { ROL_LABEL, type RoleName } from '@/lib/constants'
import type { VarianteShell } from './nav-items'
import { NavList } from './nav-list'

/** Datos del usuario que cruzan al cliente: solo valores serializables. */
export type ShellUser = { userName: string; roleName: RoleName | null; fraccionamientoNombre: string; variante: VarianteShell }

export const SUBTITULO_PLATAFORMA = 'Consola de plataforma'

export const subtituloShell = (user: ShellUser) =>
  user.variante === 'plataforma' ? SUBTITULO_PLATAFORMA : user.fraccionamientoNombre

export const rolShell = (user: ShellUser) => (user.variante === 'plataforma' ? ROL_LABEL.super_admin : user.roleName ? ROL_LABEL[user.roleName] : null)

export function SidebarContent({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="px-6 py-6">
        <BrandLogo width={160} subtitulo={subtituloShell(user)} />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <NavList roleName={user.roleName} variante={user.variante} onNavigate={onNavigate} />
      </div>
      <div className="flex items-center gap-3 border-t border-border p-4">
        <Avatar name={user.userName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-brand-navy">{user.userName}</p>
          {rolShell(user) && <p className="truncate text-xs text-muted-foreground">{rolShell(user)}</p>}
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Cerrar sesión">
            <LogOut strokeWidth={1.75} />
          </Button>
        </form>
      </div>
    </div>
  )
}
