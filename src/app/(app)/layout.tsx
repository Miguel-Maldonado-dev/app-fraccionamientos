import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppBar } from '@/components/layout/app-bar'
import { Sidebar } from '@/components/layout/sidebar'
import { estadoAcceso, getTenantContext, toCurrentUser } from '@/lib/auth/tenant-context'
import { PRODUCTO } from '@/lib/constants'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantContext()
  const nombre = ctx?.fraccionamiento?.nombre
  return { title: nombre ? `${nombre} · ${PRODUCTO}` : PRODUCTO }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext()
  if (!ctx) redirect('/login')
  const estado = estadoAcceso(ctx)
  if (estado === 'super_admin') redirect('/admin')
  if (estado === 'sin_acceso') redirect('/sin-acceso')

  const user = toCurrentUser(ctx)

  // Solo datos serializables cruzan a los componentes cliente del shell;
  // los ítems de navegación (con iconos) se resuelven en el cliente a partir del rol.
  const shellUser = {
    userName: user.userName,
    roleName: user.roleName,
    fraccionamientoNombre: ctx.fraccionamiento?.nombre ?? '',
    variante: 'fraccionamiento' as const,
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
