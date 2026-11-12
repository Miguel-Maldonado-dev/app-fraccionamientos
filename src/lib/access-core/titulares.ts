import 'server-only'
import { llamar } from './http'
import type { TitularCrear, TitularEditar } from './tipos'

const base = (instalacionId: string) => `/installations/${instalacionId}/holders`

export const crearTitular = (instalacionId: string, cuerpo: TitularCrear, idempotencyKey: string) =>
  llamar<{ id: string }>('POST', base(instalacionId), { cuerpo, idempotencyKey })

export const editarTitular = (instalacionId: string, id: string, cuerpo: TitularEditar, idempotencyKey: string) =>
  llamar<{ id: string }>('PATCH', `${base(instalacionId)}/${id}`, { cuerpo, idempotencyKey })

export const borrarTitular = (instalacionId: string, id: string, idempotencyKey: string) =>
  llamar<{ id: string }>('DELETE', `${base(instalacionId)}/${id}`, { idempotencyKey })

// Las operaciones de PIN no admiten Idempotency-Key (la API responde 400).

export async function fijarPin(instalacionId: string, titularId: string, pin: string): Promise<void> {
  await llamar('PUT', `${base(instalacionId)}/${titularId}/pin`, { cuerpo: { pin } })
}

export async function generarPin(instalacionId: string, titularId: string): Promise<string> {
  const data = await llamar<{ pin: string }>('PUT', `${base(instalacionId)}/${titularId}/pin`, {
    cuerpo: { generate: true },
  })
  return data.pin
}

export async function quitarPin(instalacionId: string, titularId: string): Promise<void> {
  await llamar('DELETE', `${base(instalacionId)}/${titularId}/pin`)
}
