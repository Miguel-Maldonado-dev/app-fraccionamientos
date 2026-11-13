import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { almacen } from './lib/almacen'
import { alRechazarSesion, ApiError } from './lib/api'
import {
  cargarYo,
  debeCerrarSesion,
  mensajeDeErrorYo,
  MENSAJE_SIN_CONEXION, entrar as entrarApi, type DomicilioYo, type ResultadoEntrar, type Yo } from './lib/auth'
import { supabase } from './lib/supabase'

const CLAVE_DOMICILIO = 'weadmi.domicilio'

type Sesion = {
  cargando: boolean
  session: Session | null
  yo: Yo | null
  /** Error de red/servidor al cargar `/yo` al arrancar (la sesión se conserva). */
  errorInicio: string | null
  /** Motivo por el que se cerró la sesión sola (401 / otro dispositivo), para mostrarlo en el login. */
  aviso: string | null
  reintentar: () => Promise<void>
  entrar: (telefono: string, password: string) => Promise<ResultadoEntrar>
  salir: () => Promise<void>
  recargarYo: () => Promise<void>
}
type DomicilioCtx = {
  domicilio: DomicilioYo | null
  domicilios: DomicilioYo[]
  seleccionar: (id: number) => void
}

const SesionContext = createContext<Sesion | null>(null)
const DomicilioContext = createContext<DomicilioCtx | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [yo, setYo] = useState<Yo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [domicilioId, setDomicilioId] = useState<number | null>(null)

  const [errorInicio, setErrorInicio] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Cualquier llamada a la API que la rechace (401 definitivo / otro_dispositivo) cierra la sesión.
  useEffect(
    () =>
      alRechazarSesion((e) => {
        setAviso(mensajeDeErrorYo(e))
        setYo(null)
        supabase.auth.signOut().catch(() => {})
      }),
    [],
  )

  /** Carga `/yo` con la sesión guardada. Cierra sesión solo si el servidor la rechaza (401/403 dispositivo). */
  const cargarInicial = useCallback(async () => {
    setErrorInicio(null)
    try {
      setYo(await cargarYo())
    } catch (e) {
      if (debeCerrarSesion(e)) return // el manejador de alRechazarSesion ya cerró la sesión
      else setErrorInicio(e instanceof ApiError && e.status !== 0 && e.status < 500 ? e.mensaje : MENSAJE_SIN_CONEXION)
    }
  }, [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!vivo) return
        setSession(data.session)
        if (data.session) await cargarInicial()
        const guardado = await almacen.getItem(CLAVE_DOMICILIO).catch(() => null)
        if (vivo && guardado) setDomicilioId(Number(guardado))
      } catch {
        if (vivo) setSession(null)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
      if (!s) setYo(null)
    })
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [cargarInicial])

  const entrar = useCallback(async (telefono: string, password: string) => {
    const r = await entrarApi(telefono, password)
    setAviso(null) // el login muestra su propio mensaje
    if (r.ok) setYo(r.yo)
    return r
  }, [])
  const salir = useCallback(async () => {
    setAviso(null)
    await supabase.auth.signOut()
    setYo(null)
  }, [])
  const recargarYo = useCallback(async () => setYo(await cargarYo()), [])
  const reintentar = cargarInicial

  const domicilios = useMemo(() => yo?.domicilios ?? [], [yo])
  const domicilio =
    domicilios.find((d) => d.id === domicilioId) ?? domicilios.find((d) => d.es_principal) ?? domicilios[0] ?? null
  const seleccionar = useCallback((id: number) => {
    setDomicilioId(id)
    almacen.setItem(CLAVE_DOMICILIO, String(id)).catch(() => {})
  }, [])

  return (
    <SesionContext.Provider value={{ cargando, session, yo, errorInicio, aviso, reintentar, entrar, salir, recargarYo }}>
      <DomicilioContext.Provider value={{ domicilio, domicilios, seleccionar }}>{children}</DomicilioContext.Provider>
    </SesionContext.Provider>
  )
}

export function useSesion(): Sesion {
  const c = useContext(SesionContext)
  if (!c) throw new Error('useSesion fuera de SesionProvider')
  return c
}

export function useDomicilio(): DomicilioCtx {
  const c = useContext(DomicilioContext)
  if (!c) throw new Error('useDomicilio fuera de SesionProvider')
  return c
}
