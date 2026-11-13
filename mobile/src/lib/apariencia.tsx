import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { paletaPara, type Esquema, type Paleta } from './tema'

export type Preferencia = 'auto' | 'claro' | 'oscuro'
export const CLAVE_APARIENCIA = 'apariencia'

type Valor = { preferencia: Preferencia; setPreferencia: (p: Preferencia) => void; esquema: Esquema }

// Sin proveedor (pruebas de componentes aislados) ⇒ claro.
const Contexto = createContext<Valor>({ preferencia: 'auto', setPreferencia: () => {}, esquema: 'claro' })

const esValida = (v: unknown): v is Preferencia => v === 'auto' || v === 'claro' || v === 'oscuro'

export function AparienciaProvider({ children }: { children: ReactNode }) {
  const sistema = useColorScheme()
  const [preferencia, setEstado] = useState<Preferencia>('auto')
  // Si el usuario elige antes de que termine la lectura, la lectura tardía se ignora.
  const elegida = useRef(false)

  useEffect(() => {
    let vivo = true
    SecureStore.getItemAsync(CLAVE_APARIENCIA)
      .then((v) => {
        if (vivo && !elegida.current && esValida(v)) setEstado(v)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  const setPreferencia = useCallback((p: Preferencia) => {
    elegida.current = true
    setEstado(p)
    SecureStore.setItemAsync(CLAVE_APARIENCIA, p).catch(() => {})
  }, [])

  const esquema: Esquema = preferencia === 'auto' ? (sistema === 'dark' ? 'oscuro' : 'claro') : preferencia
  const valor = useMemo(() => ({ preferencia, setPreferencia, esquema }), [preferencia, setPreferencia, esquema])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useApariencia = () => useContext(Contexto)

export function useTema(): Paleta {
  return paletaPara(useApariencia().esquema)
}

/**
 * Estilos dependientes del tema, memoizados por esquema. Define `crear` fuera del componente:
 *   const crearEstilos = (c: Paleta) => StyleSheet.create({ caja: { backgroundColor: c.superficie } })
 *   const styles = useEstilos(crearEstilos)
 */
export function useEstilos<T>(crear: (c: Paleta, esquema: Esquema) => T): T {
  const { esquema } = useApariencia()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => crear(paletaPara(esquema), esquema), [esquema])
}
