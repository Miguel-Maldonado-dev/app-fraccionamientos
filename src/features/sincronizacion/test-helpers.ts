import { vi } from 'vitest'
import type { Tarea } from './tipos'

let n = 0

/** Tarea pendiente con valores por omisión; `id` único por llamada. */
export function tarea(over: Partial<Tarea> = {}): Tarea {
  n += 1
  return {
    id: `t${n}`,
    fraccionamiento_id: 7,
    domicilio_id: 1,
    entidad: 'domicilio',
    entidad_id: null,
    operacion: 'crear',
    carga: {},
    estado: 'pendiente',
    intentos: 0,
    ultimo_error: null,
    proximo_intento_at: '2026-11-11T11:00:00.000Z',
    created_at: `2026-11-11T10:00:${String(n % 60).padStart(2, '0')}.000Z`,
    updated_at: '2026-11-11T10:00:00.000Z',
    ...over,
  }
}

/** Cliente de access-core simulado: cada función es un `vi.fn` que responde algo razonable. */
export function apiFalsa() {
  return {
    listarPerfiles: vi.fn(async () => [] as { id: string; name: string; holder_ids: string[] }[]),
    asignarTitulares: vi.fn(async () => ({ id: 'p', name: 'p', holder_ids: [] })),
    crearTitular: vi.fn(async () => ({ id: 'h-nuevo' })),
    editarTitular: vi.fn(async () => ({ id: 'h' })),
    borrarTitular: vi.fn(async () => ({ id: 'h' })),
    fijarPin: vi.fn(async () => undefined),
    quitarPin: vi.fn(async () => undefined),
    crearTarjeta: vi.fn(async () => ({ id: 'tj-nueva' })),
    editarTarjeta: vi.fn(async () => ({ id: 'tj' })),
    borrarTarjeta: vi.fn(async () => ({ id: 'tj' })),
    crearControl: vi.fn(),
    reemplazarControl: vi.fn(),
    borrarControl: vi.fn(async () => ({ id: 'c' })),
  }
}
