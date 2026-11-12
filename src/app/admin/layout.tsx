import { AppBar } from '@/components/layout/app-bar'
import { Sidebar } from '@/components/layout/sidebar'
import type { ShellUser } from '@/components/layout/sidebar-content'
import { requireSuperAdminPage } from '@/lib/auth/require-super-admin-page'
import { getTenantContext } from '@/lib/auth/tenant-context'

/** Consola del super admin: cualquier otro estado responde 404 para no revelar la ruta. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPage()
  const ctx = await getTenantContext()

  // Solo datos serializables cruzan al cliente; el menú de consola se resuelve allí por `variante`.
  const shellUser: ShellUser = {
    userName: ctx?.perfil?.nombre ?? 'Super admin',
    roleName: null,
    fraccionamientoNombre: '',
    variante: 'plataforma',
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={shellUser} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppBar user={shellUser} />
        <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
