import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { getResumenFinanciero } from '@/features/dashboard/queries'
import { MovimientosView } from '@/features/movimientos/components/movimientos-view'
import { RegistrarMovimientoDialog } from '@/features/movimientos/components/registrar-movimiento-dialog'
import { listMovimientos, listTiposMovimiento } from '@/features/movimientos/queries'
import { listMetodosPago } from '@/features/pagos/queries'
import { getTenantContext, toCurrentUser } from '@/lib/auth/tenant-context'
import { hasRole } from '@/lib/auth/require-role'
import { ROLES_GESTION } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

export default async function MovimientosPage() {
  const supabase = await createClient()
  const [ctx, resumen, rows, tipos, metodos] = await Promise.all([
    getTenantContext(),
    getResumenFinanciero(supabase),
    listMovimientos(supabase),
    listTiposMovimiento(supabase),
    listMetodosPago(supabase),
  ])

  const user = ctx ? toCurrentUser(ctx) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos Financieros"
        description="Consulta y administra todos los movimientos financieros del fraccionamiento."
        breadcrumbs={[{ label: 'Movimientos' }]}
        actions={
          hasRole(user, ROLES_GESTION) ? (
            <RegistrarMovimientoDialog
              tipos={tipos}
              metodos={metodos}
              trigger={
                <Button>
                  <Plus />
                  Nuevo Movimiento
                </Button>
              }
            />
          ) : undefined
        }
      />
      <MovimientosView
        rows={rows}
        saldo={resumen?.saldo_actual ?? null}
        fraccionamientoNombre={ctx?.fraccionamiento?.nombre ?? ''}
      />
    </div>
  )
}
