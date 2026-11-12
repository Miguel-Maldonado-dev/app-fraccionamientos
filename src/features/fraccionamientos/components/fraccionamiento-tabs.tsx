'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ETIQUETA_TAB, TABS_FRACCIONAMIENTO, type TabFraccionamiento } from '../tabs'

/** Pestañas del detalle de un fraccionamiento en la consola; la pestaña activa vive en `?tab=`. */
export function FraccionamientoTabs({
  id,
  tab,
  children,
}: {
  id: number
  tab: TabFraccionamiento
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => router.replace(`/admin/fraccionamientos/${id}?tab=${v}`)}
      className="space-y-4"
    >
      <TabsList className="h-auto flex-wrap">
        {TABS_FRACCIONAMIENTO.map((t) => (
          <TabsTrigger key={t} value={t}>
            {ETIQUETA_TAB[t]}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}
