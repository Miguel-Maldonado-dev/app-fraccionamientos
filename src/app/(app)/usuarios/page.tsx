import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { AddUserDialog } from '@/features/usuarios/components/add-user-dialog'
import { UsuariosView } from '@/features/usuarios/components/usuarios-view'
import { listUsuarios } from '@/features/usuarios/queries'
import { getCurrentUser } from '@/lib/auth/tenant-context'
import { AuthorizationError, requireRole } from '@/lib/auth/require-role'
import { ROLES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string | string[] }>
}) {
  try {
    await requireRole(ROLES.ADMINISTRADOR)
  } catch (e) {
    if (e instanceof AuthorizationError) notFound()
    throw e
  }

  const sp = await searchParams
  const estado = first(sp.estado) === 'inactivos' ? 'inactivos' : 'activos'

  const supabase = await createClient()
  const [user, rows] = await Promise.all([
    getCurrentUser(),
    listUsuarios(supabase, estado === 'activos'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestiona los usuarios del fraccionamiento."
        breadcrumbs={[{ label: 'Usuarios' }]}
        actions={<AddUserDialog />}
      />
      <UsuariosView rows={rows} currentUserId={user?.id ?? ''} estado={estado} />
    </div>
  )
}
