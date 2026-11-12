import type { Database } from '@/lib/supabase/database.types'

export type Rol = Database['public']['Enums']['rol_usuario']
export type MedioAcceso = Database['public']['Enums']['medio_acceso']

export const ROLES = {
  ADMINISTRADOR: 'administrador',
  TESORERO: 'tesorero',
  COMITE: 'comite',
  VIGILANCIA: 'vigilancia',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

export const SUPER_ADMIN = 'super_admin' as const

export const ROLES_FRACCIONAMIENTO = [ROLES.ADMINISTRADOR, ROLES.TESORERO, ROLES.COMITE, ROLES.VIGILANCIA] as const

export const ROL_LABEL: Record<Rol, string> = {
  super_admin: 'Super admin',
  administrador: 'Administrador',
  tesorero: 'Tesorero',
  comite: 'Comité',
  vigilancia: 'Vigilancia',
}

export const PRODUCTO = 'WEADMI'

export const ROLES_GESTION: RoleName[] = [ROLES.ADMINISTRADOR, ROLES.TESORERO]

export const ESTATUS = { PENDIENTE: 1, PAGADO: 2, VENCIDO: 3 } as const
export const TIPO_PAGO = { RECURRENTE: 1, EXTRA: 2 } as const
export const TIPO_MOVIMIENTO = { INGRESO: 1, EGRESO: 2 } as const
export const LIMITES = { TELEFONOS: 2, TARJETAS: 3, CONTROLES: 2 } as const

export const MEDIOS_ACCESO: readonly MedioAcceso[] = ['tarjeta', 'control', 'pin', 'telefono', 'qr']

export const MEDIO_LABEL: Record<MedioAcceso, string> = {
  tarjeta: 'Tarjeta',
  control: 'Control RF',
  pin: 'PIN',
  telefono: 'Teléfono',
  qr: 'Código QR',
}

/** Medios que se mandan a access-core; teléfono y QR aún no los soporta. */
export const MEDIOS_SINCRONIZABLES: readonly MedioAcceso[] = ['tarjeta', 'control', 'pin']

/** Medios que el super admin puede habilitar; QR queda como "Próximamente". */
export const MEDIOS_HABILITABLES: readonly MedioAcceso[] = ['tarjeta', 'control', 'pin', 'telefono']

export const PRINT_AGENT_URL = 'http://localhost:8000/print'
export const TIME_ZONE = 'America/Mexico_City'
