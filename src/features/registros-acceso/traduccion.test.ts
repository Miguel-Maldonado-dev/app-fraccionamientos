import { describe, expect, it } from 'vitest'
import type { Log } from '@/lib/access-core/tipos'
import { fechaHoraMexico, formatearTs, traducirLog } from './traduccion'

const base: Log = {
  id: 1, ts: '2026-11-13T19:05:09-06:00', panel_id: 'p', panel_code: 'P1', allowed: true, source: 0, reason: 0,
  holder_id: null, holder_name: null, holder_kind: null, credential_label: null, control_id: null,
  code: null, device_id: null, output_index: null, output_alias: null,
}

describe('traducirLog', () => {
  it('titular: domicilio, nombre o raya', () => {
    const mapa = new Map([['h1', 'Calle 1 #2']])
    expect(traducirLog({ ...base, holder_id: 'h1', holder_name: 'Ana' }, mapa).titular).toBe('Calle 1 #2')
    expect(traducirLog({ ...base, holder_id: 'h2', holder_name: 'Ana' }, mapa).titular).toBe('Ana')
    expect(traducirLog(base, mapa).titular).toBe('—')
  })
  it('credencial y salida', () => {
    const m = new Map<string, string>()
    expect(traducirLog({ ...base, credential_label: 'Tarjeta 5', code: 9 }, m).credencial).toBe('Tarjeta 5')
    expect(traducirLog({ ...base, code: 9 }, m).credencial).toBe('9')
    expect(traducirLog({ ...base, code: 0 }, m).credencial).toBe('0')
    expect(traducirLog({ ...base, output_alias: 'Peatonal', output_index: 1 }, m).salida).toBe('Peatonal')
    expect(traducirLog({ ...base, output_index: 2 }, m).salida).toBe('Salida 2')
    expect(traducirLog({ ...base, output_index: 0 }, m).salida).toBe('Salida 0')
  })
  it('cadenas vacías caen a raya', () => {
    const f = traducirLog({ ...base, holder_name: '', credential_label: '', output_alias: '' }, new Map())
    expect(f).toMatchObject({ titular: '—', credencial: '—', salida: '—' })
  })
  it('origen, motivo y resultado', () => {
    const f = traducirLog({ ...base, allowed: false, source: 4, reason: 10 }, new Map())
    expect(f).toMatchObject({ origen: 'Remota (app)', motivo: 'PIN bloqueado', resultado: 'Denegado', permitido: false })
  })
  it('log con opcionales nulos no falla', () => {
    expect(traducirLog(base, new Map())).toMatchObject({
      titular: '—', credencial: '—', salida: '—', fechaHora: '13/11/2026 19:05:09', resultado: 'Permitido',
    })
  })
})

describe('formatearTs', () => {
  it('UTC (Z) se convierte a hora del centro de México (caso real: 20:51 UTC ⇒ 14:51)', () => {
    expect(formatearTs('2026-11-13T20:51:00Z')).toBe('13/11/2026 14:51:00')
    expect(formatearTs('2026-11-13T01:02:03.123Z')).toBe('12/11/2026 19:02:03')
  })

  it('con desfase explícito se convierte; sin zona se respeta la hora de pared', () => {
    expect(formatearTs('2026-11-13T19:05:09-06:00')).toBe('13/11/2026 19:05:09')
    expect(formatearTs('2026-11-13T23:59:58.123456+05:30')).toBe('13/11/2026 12:29:58')
    expect(formatearTs('2026-11-13T14:51:00')).toBe('13/11/2026 14:51:00')
  })
})

describe('fechaHoraMexico', () => {
  it('dd/mm/aaaa HH:mm:ss en America/Mexico_City, 24 h con ceros', () => {
    expect(fechaHoraMexico(new Date('2026-11-13T06:05:09Z'))).toBe('13/11/2026 00:05:09')
    expect(fechaHoraMexico(new Date('2026-11-13T21:00:00Z'))).toBe('13/11/2026 15:00:00')
  })
})
