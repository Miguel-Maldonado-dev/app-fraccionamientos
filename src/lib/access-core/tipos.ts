// Tipos escritos a mano a partir de docs/integraciones/access-core-openapi.json (solo lo que usa la app).

export type Instalacion = { id: string; name: string; revision: number }

export type Panel = {
  id: string
  panel_code: string
  status: 'pending' | 'claimed' | 'staging' | 'awaiting_review' | 'active' | 'revoked'
  online: boolean
  last_sync_at: string | null
  synced_revision: number
  software_version: string | null
}

export type Salida = {
  id: string
  panel_id: string
  output_index: number
  alias: string
  duration_ms: number
  reader_mask: number
  enabled: boolean
}

export type Perfil = { id: string; name: string; holder_ids: string[] }

export type TitularTipo = 'persona' | 'domicilio'

export type Titular = {
  id: string
  kind: TitularTipo
  name: string
  department: string
  address: string
  notes: string
  has_pin: boolean
  card_count: number
  control_count: number
}

export type TitularCrear = {
  kind: TitularTipo
  name: string
  department?: string
  address?: string
  notes?: string
}

export type TitularEditar = Partial<TitularCrear>

export type Tarjeta = {
  id: string
  card_code: number
  holder_id: string
  holder_name: string
  description: string
}

export type TarjetaCrear = { card_code: number; holder_id: string; description?: string }

export type TarjetaEditar = { holder_id?: string; description?: string }

/** `panel_id` → índice de salida (0 a 3), `null` = ninguna, `'sin_salida'` conserva un vínculo sin salida. */
export type SalidasPorPanel = Record<string, number | null | 'sin_salida'>

export type Boton = {
  id: string
  button: number
  rf_code: number
  outputs: Record<string, number | null>
}

export type Control = {
  id: string
  holder_id: string
  holder_name: string
  description: string
  buttons: Boton[]
}

export type BotonCuerpo = {
  id?: string | null
  button: number
  rf_code?: number | null
  outputs?: SalidasPorPanel
}

export type ControlCuerpo = { holder_id: string; description?: string; buttons: BotonCuerpo[] }

export type Log = {
  id: number
  ts: string
  panel_id: string
  panel_code: string
  allowed: boolean
  /** 0 tarjeta, 1 control RF, 2 botón de salida, 3 PIN, 4 remota, 5 prueba. */
  source: 0 | 1 | 2 | 3 | 4 | 5
  /** 0–11, ver `MOTIVOS`. */
  reason: number
  holder_id: string | null
  holder_name: string | null
  holder_kind: 'persona' | 'domicilio' | null
  credential_label: string | null
  control_id: string | null
  code: number | null
  device_id: number | null
  output_index: number | null
  output_alias: string | null
}
