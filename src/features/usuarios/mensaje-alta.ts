import { MSG_ERROR } from '@/lib/auth/run-action'
import type { ResultadoAltaUsuario } from './alta'
import { MSG_EMAIL_DUPLICADO } from './messages'

/** Mensaje para el usuario según el motivo por el que falló `altaUsuario` (app y consola). */
export function mensajeAltaFallida(motivo: Extract<ResultadoAltaUsuario, { ok: false }>['motivo']): string {
  return motivo === 'email_duplicado' ? MSG_EMAIL_DUPLICADO : MSG_ERROR
}
