import { redirect } from 'next/navigation'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getTenantContext } from '@/lib/auth/tenant-context'

export default async function SinAccesoPage() {
  const ctx = await getTenantContext()
  if (!ctx) redirect('/login')

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[440px]">
        <CardHeader className="items-center justify-items-center gap-3 text-center">
          <BrandLogo width={180} />
          <h1 className="text-[26px] font-semibold">Sin acceso</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-center">
          <p className="text-sm text-secondary-foreground">
            Tu acceso está desactivado. Contacta al administrador.
          </p>
          {/* GET a la ruta de cierre de sesión: funciona sin JavaScript. */}
          <form action="/api/auth/signout">
            <Button type="submit" className="w-full">
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
