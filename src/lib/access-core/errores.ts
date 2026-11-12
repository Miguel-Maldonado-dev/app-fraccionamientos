/** Error devuelto por la API de access-core (o `status` 0 si no hubo respuesta). */
export class AccessCoreError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: number

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.name = 'AccessCoreError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }

  /** Errores de red, 429, 500, 502, 503 y 504 se pueden reintentar; el resto no. */
  get reintentable(): boolean {
    return this.status === 0 || this.status === 429 || [500, 502, 503, 504].includes(this.status)
  }
}

/** Falta `ACCESS_CORE_API_KEY`: la integración no está configurada. */
export class AccessCoreNoConfigurado extends Error {
  constructor() {
    super('access-core no está configurado: falta ACCESS_CORE_API_KEY.')
    this.name = 'AccessCoreNoConfigurado'
  }
}
