'use client'

import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CATALOGOS, ETIQUETA_TAB_REGLAS, TABS_CONFIGURACION, type TabConfiguracion } from '../catalogos'

export function CatalogosTabs({ tab, children }: { tab: TabConfiguracion; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`)} className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        {TABS_CONFIGURACION.map((t) => (
          <TabsTrigger key={t} value={t}>
            {t === 'reglas' ? ETIQUETA_TAB_REGLAS : CATALOGOS[t].tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}
