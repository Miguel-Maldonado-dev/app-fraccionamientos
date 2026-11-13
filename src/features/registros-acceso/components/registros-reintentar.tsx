'use client'

import { useRouter } from 'next/navigation'
import { ErrorState } from '@/components/error-state'

/** Error de consulta con botón Reintentar (vuelve a pedir la página al servidor). */
export function RegistrosError({ mensaje }: { mensaje: string }) {
  const router = useRouter()
  return <ErrorState title="No se pudieron mostrar los registros" description={mensaje} onRetry={() => router.refresh()} />
}
