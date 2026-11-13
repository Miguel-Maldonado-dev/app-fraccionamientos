import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, MENSAJE_SIN_CONEXION } from './api'
import { debeCerrarSesion } from './auth'

/** Mensaje para un error de carga (el servidor manda el texto en 4xx; red/5xx ⇒ genérico). */
export function mensajeDeCarga(e: unknown): string {
  if (e instanceof ApiError) return e.status !== 0 && e.status < 500 ? e.mensaje : MENSAJE_SIN_CONEXION
  return e instanceof Error && e.message ? e.message : MENSAJE_SIN_CONEXION
}

/** Carga datos con `cargar` (se repite cuando cambia) y permite refrescar. Ignora respuestas viejas. */
export function useCarga<T>(cargar: (() => Promise<T>) | null) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const peticion = useRef(0)

  const ejecutar = useCallback(async () => {
    if (!cargar) return
    const n = ++peticion.current
    setError(null)
    try {
      const d = await cargar()
      if (n === peticion.current) setDatos(d)
    } catch (e) {
      if (n !== peticion.current || debeCerrarSesion(e)) return // la sesión ya se cerró
      setDatos(null)
      setError(mensajeDeCarga(e))
    }
  }, [cargar])

  useEffect(() => {
    setCargando(true)
    setDatos(null)
    ejecutar().finally(() => setCargando(false))
  }, [ejecutar])

  const refrescar = useCallback(async () => {
    setRefrescando(true)
    await ejecutar()
    setRefrescando(false)
  }, [ejecutar])

  return { datos, error, cargando: cargando && datos === null, refrescar, refrescando }
}
