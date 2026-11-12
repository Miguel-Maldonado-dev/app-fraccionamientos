import { notFound } from 'next/navigation'
import { estadoAcceso, getTenantContext } from '@/lib/auth/tenant-context'

/** Guardia de las páginas de `/admin`: cualquier estado que no sea super admin responde 404. */
export async function requireSuperAdminPage(): Promise<void> {
  const ctx = await getTenantContext()
  if (!ctx || estadoAcceso(ctx) !== 'super_admin') notFound()
}
