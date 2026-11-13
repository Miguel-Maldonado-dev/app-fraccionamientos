'use client'

import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { VistaAccesos } from '../vistas'

/** Pestañas Registros / Sincronización; la vista activa vive en `?vista=` (más los `fijos`, p. ej. `tab`). */
export function AccesosVistas({
  vista,
  fijos = {},
  children,
}: {
  vista: VistaAccesos
  fijos?: Record<string, string>
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <Tabs
      value={vista}
      onValueChange={(v) => router.replace(`${pathname}?${new URLSearchParams({ ...fijos, vista: v })}`)}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="registros">Registros</TabsTrigger>
        <TabsTrigger value="sincronizacion">Sincronización</TabsTrigger>
      </TabsList>
      <TabsContent value={vista}>{children}</TabsContent>
    </Tabs>
  )
}
