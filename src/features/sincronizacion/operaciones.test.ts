// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb } from '@/test/fake-db'
import { apiFalsa, tarea } from './test-helpers'

vi.mock('server-only', () => ({}))

import { ejecutar, type Contexto } from './operaciones'

const INST = 'inst-1'
let api: ReturnType<typeof apiFalsa>

beforeEach(() => {
  api = apiFalsa()
})

function contexto(tablas: Parameters<typeof fakeDb>[0], rpc?: Parameters<typeof fakeDb>[1]) {
  const db = fakeDb(tablas, rpc)
  const ctx: Contexto = { admin: db.client as never, instalacionId: INST, api: api as never }
  return { db, ctx }
}

/** Tipo de cuota del domicilio 1 con los medios permitidos. */
const permite = (...medios: string[]) => ({
  domicilio_concepto: [{ domicilio_id: 1, concepto_id: 5 }],
  concepto_pago_acceso: [{ concepto_pago_id: 5, medios }],
})

const domicilio = (over: Record<string, unknown> = {}) => ({ id: 1, fraccionamiento_id: 7, titular_id: 'h1', perfil_asignado_id: null, ...over })

describe('domicilio', () => {
  it('crear manda el titular y guarda titular_id', async () => {
    const { db, ctx } = contexto({ domicilios: [domicilio({ titular_id: null })] })
    const t = tarea({ carga: { kind: 'domicilio', name: 'LAGO 1', address: 'LAGO 1', notes: '' } })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.crearTitular).toHaveBeenCalledWith(INST, { kind: 'domicilio', name: 'LAGO 1', address: 'LAGO 1', notes: '' }, t.id)
    expect(db.tablas.domicilios[0].titular_id).toBe('h-nuevo')
  })

  it('crear no pisa un titular_id guardado mientras tanto', async () => {
    const { db, ctx } = contexto({ domicilios: [domicilio({ titular_id: null })] })
    api.crearTitular.mockImplementation(async () => {
      db.tablas.domicilios[0].titular_id = 'h-otro'
      return { id: 'h-nuevo' }
    })
    expect(await ejecutar(ctx, tarea({ carga: { name: 'x', address: 'x', notes: '' } }))).toEqual({ ok: true })
    expect(db.tablas.domicilios[0].titular_id).toBe('h-otro')
  })

  it('actualizar edita el titular', async () => {
    const { ctx } = contexto({ domicilios: [domicilio()] })
    const t = tarea({ operacion: 'actualizar', carga: { kind: 'domicilio', name: 'LAGO 2', address: 'LAGO 2', notes: 'x' } })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.editarTitular).toHaveBeenCalledWith(INST, 'h1', { name: 'LAGO 2', address: 'LAGO 2', notes: 'x' }, t.id)
  })

  it('borrar no está soportado', async () => {
    const { ctx } = contexto({ domicilios: [domicilio()] })
    const r = await ejecutar(ctx, tarea({ operacion: 'borrar' }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error.message).toBe('Operación no soportada')
  })

  describe('asignar', () => {
    const perfiles = [
      { id: 'P1', name: 'Residentes', holder_ids: ['h1', 'h9'] },
      { id: 'P2', name: 'Morosos', holder_ids: [] },
    ]

    it('quita del perfil viejo, agrega al deseado y guarda perfil_asignado_id', async () => {
      const rpc = vi.fn(async () => ({ data: 'P2', error: null }))
      const { db, ctx } = contexto({ domicilios: [domicilio()] }, rpc)
      api.listarPerfiles.mockResolvedValue(perfiles)
      const t = tarea({ operacion: 'asignar' })
      expect(await ejecutar(ctx, t)).toEqual({ ok: true })
      expect(rpc).toHaveBeenCalledWith('perfil_deseado', { p_domicilio_id: 1 })
      expect(api.asignarTitulares).toHaveBeenCalledTimes(2)
      expect(api.asignarTitulares).toHaveBeenCalledWith(INST, 'P1', ['h9'], `${t.id}:P1`)
      expect(api.asignarTitulares).toHaveBeenCalledWith(INST, 'P2', ['h1'], `${t.id}:P2`)
      expect(db.tablas.domicilios[0].perfil_asignado_id).toBe('P2')
    })

    it('con deseado nulo solo quita', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: null }))
      const { db, ctx } = contexto({ domicilios: [domicilio({ perfil_asignado_id: 'P1' })] }, rpc)
      api.listarPerfiles.mockResolvedValue(perfiles)
      const t = tarea({ operacion: 'asignar' })
      expect(await ejecutar(ctx, t)).toEqual({ ok: true })
      expect(api.asignarTitulares).toHaveBeenCalledTimes(1)
      expect(api.asignarTitulares).toHaveBeenCalledWith(INST, 'P1', ['h9'], `${t.id}:P1`)
      expect(db.tablas.domicilios[0].perfil_asignado_id).toBeNull()
    })

    it('si el perfil deseado ya no existe en access-core falla sin reintento y sin tocar perfiles', async () => {
      const { AccessCoreError } = await import('@/lib/access-core')
      const rpc = vi.fn(async () => ({ data: 'P-borrado', error: null }))
      const { db, ctx } = contexto({ domicilios: [domicilio({ perfil_asignado_id: 'P1' })] }, rpc)
      api.listarPerfiles.mockResolvedValue(perfiles)
      const r = await ejecutar(ctx, tarea({ operacion: 'asignar' }))
      expect(r.ok).toBe(false)
      expect(!r.ok && r.error.message).toBe('El permiso configurado ya no existe en access-core')
      expect(!r.ok && r.error instanceof AccessCoreError).toBe(false)
      expect(api.asignarTitulares).not.toHaveBeenCalled()
      expect(db.tablas.domicilios[0].perfil_asignado_id).toBe('P1')
    })

    it('si ya está en el deseado no lo vuelve a mandar', async () => {
      const rpc = vi.fn(async () => ({ data: 'P1', error: null }))
      const { ctx } = contexto({ domicilios: [domicilio()] }, rpc)
      api.listarPerfiles.mockResolvedValue(perfiles)
      expect(await ejecutar(ctx, tarea({ operacion: 'asignar' }))).toEqual({ ok: true })
      expect(api.asignarTitulares).not.toHaveBeenCalled()
    })
  })

  describe('reconciliar', () => {
    const base = (medios: string[]) => ({
      domicilios: [domicilio()],
      domicilio_concepto: [{ domicilio_id: 1, concepto_id: 5 }],
      concepto_pago_acceso: [{ concepto_pago_id: 5, medios }],
    })

    it('crea la tarjeta sin tarjeta_id cuando el medio está permitido', async () => {
      const { db, ctx } = contexto({
        ...base(['tarjeta']),
        tarjetas_acceso: [{ id: 10, domicilio_id: 1, numero: '12345', descripcion: null, tarjeta_id: null }],
      })
      const t = tarea({ operacion: 'reconciliar' })
      expect(await ejecutar(ctx, t)).toEqual({ ok: true })
      expect(api.crearTarjeta).toHaveBeenCalledWith(INST, { card_code: 12345, holder_id: 'h1', description: '' }, `${t.id}:tarjeta:10:crear`)
      expect(db.tablas.tarjetas_acceso[0].tarjeta_id).toBe('tj-nueva')
    })

    it('borra la tarjeta con tarjeta_id cuando el medio ya no está permitido y conserva la fila', async () => {
      const { db, ctx } = contexto({
        ...base([]),
        tarjetas_acceso: [{ id: 10, domicilio_id: 1, numero: '12345', descripcion: null, tarjeta_id: 'tj-1' }],
      })
      const t = tarea({ operacion: 'reconciliar' })
      expect(await ejecutar(ctx, t)).toEqual({ ok: true })
      expect(api.borrarTarjeta).toHaveBeenCalledWith(INST, 'tj-1', `${t.id}:tarjeta:10:borrar`)
      expect(db.tablas.tarjetas_acceso).toHaveLength(1)
      expect(db.tablas.tarjetas_acceso[0].tarjeta_id).toBeNull()
    })

    it('sin tipo de cuota no permite ningún medio', async () => {
      const { ctx } = contexto({
        domicilios: [domicilio()],
        tarjetas_acceso: [{ id: 10, domicilio_id: 1, numero: '1', descripcion: null, tarjeta_id: 'tj-1' }],
      })
      expect(await ejecutar(ctx, tarea({ operacion: 'reconciliar' }))).toEqual({ ok: true })
      expect(api.borrarTarjeta).toHaveBeenCalledTimes(1)
    })

    it('crea y borra controles según el medio', async () => {
      api.crearControl.mockResolvedValue({ id: 'c-nuevo', buttons: [{ id: 'b0', button: 0, rf_code: 1, outputs: {} }] })
      const { db, ctx } = contexto({
        ...base(['control']),
        fraccionamiento_botones: [{ fraccionamiento_id: 7, boton: 0, panel_id: 'pa', salida: 2 }],
        controles_acceso: [{ id: 20, domicilio_id: 1, control_id: null, descripcion: 'auto', botones: [{ boton: 0, rf_code: 1, boton_id: null }] }],
      })
      const t = tarea({ operacion: 'reconciliar' })
      expect(await ejecutar(ctx, t)).toEqual({ ok: true })
      expect(api.crearControl).toHaveBeenCalledWith(
        INST,
        { holder_id: 'h1', description: 'auto', buttons: [{ id: null, button: 0, rf_code: 1, outputs: { pa: 2 } }] },
        `${t.id}:control:20:crear`,
      )
      expect(db.tablas.controles_acceso[0].control_id).toBe('c-nuevo')
    })

    it('fija el PIN guardado cuando el medio pin está permitido', async () => {
      const { ctx } = contexto({ ...base(['pin']), pines_acceso: [{ domicilio_id: 1, pin: '4321' }] })
      expect(await ejecutar(ctx, tarea({ operacion: 'reconciliar' }))).toEqual({ ok: true })
      expect(api.fijarPin).toHaveBeenCalledWith(INST, 'h1', '4321')
      expect(api.quitarPin).not.toHaveBeenCalled()
    })

    it('quita el PIN en access-core cuando pin ya no está permitido y conserva el local', async () => {
      const { db, ctx } = contexto({ ...base([]), pines_acceso: [{ domicilio_id: 1, pin: '4321' }] })
      expect(await ejecutar(ctx, tarea({ operacion: 'reconciliar' }))).toEqual({ ok: true })
      expect(api.quitarPin).toHaveBeenCalledWith(INST, 'h1')
      expect(db.tablas.pines_acceso).toHaveLength(1)
    })
  })
})

describe('tarjeta', () => {
  const tablas = (over: Record<string, unknown> = {}) => ({
    domicilios: [domicilio()],
    ...permite('tarjeta'),
    tarjetas_acceso: [{ id: 10, domicilio_id: 1, numero: '987', descripcion: 'Auto', tarjeta_id: null, ...over }],
  })

  it('crear manda card_code numérico y guarda tarjeta_id', async () => {
    const { db, ctx } = contexto(tablas())
    const t = tarea({ entidad: 'tarjeta', entidad_id: 10 })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.crearTarjeta).toHaveBeenCalledWith(INST, { card_code: 987, holder_id: 'h1', description: 'Auto' }, t.id)
    expect(db.tablas.tarjetas_acceso[0].tarjeta_id).toBe('tj-nueva')
  })

  it('crear: si la fila se borró mientras se creaba, borra la tarjeta remota y termina ok', async () => {
    const { db, ctx } = contexto(tablas())
    api.crearTarjeta.mockImplementation(async () => {
      db.tablas.tarjetas_acceso.length = 0 // la fila se borra entre la lectura y el update
      return { id: 'tj-huerfana' }
    })
    const t = tarea({ entidad: 'tarjeta', entidad_id: 10 })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.borrarTarjeta).toHaveBeenCalledWith(INST, 'tj-huerfana', `${t.id}:compensar`)
    expect(api.crearTarjeta.mock.invocationCallOrder[0]).toBeLessThan(api.borrarTarjeta.mock.invocationCallOrder[0])
  })

  it('crear no hace nada si el tipo de cuota no permite tarjeta', async () => {
    const { db, ctx } = contexto({ ...tablas(), ...permite('pin') })
    expect(await ejecutar(ctx, tarea({ entidad: 'tarjeta', entidad_id: 10 }))).toEqual({ ok: true })
    expect(api.crearTarjeta).not.toHaveBeenCalled()
    expect(db.tablas.tarjetas_acceso[0].tarjeta_id).toBeNull()
  })

  it('crear no hace nada si el domicilio no tiene tipo de cuota', async () => {
    const { ctx } = contexto({ ...tablas(), domicilio_concepto: [] })
    expect(await ejecutar(ctx, tarea({ entidad: 'tarjeta', entidad_id: 10 }))).toEqual({ ok: true })
    expect(api.crearTarjeta).not.toHaveBeenCalled()
  })

  it('crear con la fila presente no compensa', async () => {
    const { ctx } = contexto(tablas())
    await ejecutar(ctx, tarea({ entidad: 'tarjeta', entidad_id: 10 }))
    expect(api.borrarTarjeta).not.toHaveBeenCalled()
  })

  it('crear no hace nada si la fila ya no existe', async () => {
    const { ctx } = contexto({ domicilios: [domicilio()], tarjetas_acceso: [] })
    expect(await ejecutar(ctx, tarea({ entidad: 'tarjeta', entidad_id: 10 }))).toEqual({ ok: true })
    expect(api.crearTarjeta).not.toHaveBeenCalled()
  })

  it('actualizar edita la descripción', async () => {
    const { ctx } = contexto(tablas({ tarjeta_id: 'tj-1' }))
    const t = tarea({ entidad: 'tarjeta', entidad_id: 10, operacion: 'actualizar' })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.editarTarjeta).toHaveBeenCalledWith(INST, 'tj-1', { description: 'Auto' }, t.id)
  })

  it('borrar usa el tarjeta_id de la carga', async () => {
    const { ctx } = contexto({ domicilios: [domicilio()], tarjetas_acceso: [] })
    const t = tarea({ entidad: 'tarjeta', entidad_id: 10, operacion: 'borrar', carga: { tarjeta_id: 'tj-9' } })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.borrarTarjeta).toHaveBeenCalledWith(INST, 'tj-9', t.id)
  })

  it('devuelve el error de la API', async () => {
    const { AccessCoreError } = await import('@/lib/access-core')
    api.crearTarjeta.mockRejectedValue(new AccessCoreError(409, 'conflict', 'Ya existe'))
    const { ctx } = contexto(tablas())
    const r = await ejecutar(ctx, tarea({ entidad: 'tarjeta', entidad_id: 10 }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error.message).toBe('Ya existe')
  })
})

describe('control: compensación', () => {
  const tablas = () => ({
    domicilios: [domicilio()],
    ...permite('control'),
    fraccionamiento_botones: [{ fraccionamiento_id: 7, boton: 0, panel_id: 'pa', salida: 1 }],
    controles_acceso: [
      { id: 20, domicilio_id: 1, control_id: null, descripcion: null, botones: [{ boton: 0, rf_code: 111, boton_id: null }] },
    ],
  })
  const remoto = { id: 'c-huerfano', buttons: [{ id: 'b0', button: 0, rf_code: 111, outputs: { pa: 1 } }] }

  it('crear: si la fila se borró mientras se creaba, borra el control remoto y termina ok', async () => {
    const { db, ctx } = contexto(tablas())
    api.crearControl.mockImplementation(async () => {
      db.tablas.controles_acceso.length = 0
      return remoto
    })
    const t = tarea({ entidad: 'control', entidad_id: 20 })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.borrarControl).toHaveBeenCalledWith(INST, 'c-huerfano', `${t.id}:compensar`)
  })

  it('crear con la fila presente guarda el id y no compensa', async () => {
    api.crearControl.mockResolvedValue(remoto)
    const { db, ctx } = contexto(tablas())
    expect(await ejecutar(ctx, tarea({ entidad: 'control', entidad_id: 20 }))).toEqual({ ok: true })
    expect(db.tablas.controles_acceso[0].control_id).toBe('c-huerfano')
    expect(api.borrarControl).not.toHaveBeenCalled()
  })
})

describe('control', () => {
  const tablas = (over: Record<string, unknown> = {}) => ({
    domicilios: [domicilio()],
    ...permite('control'),
    fraccionamiento_botones: [
      { fraccionamiento_id: 7, boton: 0, panel_id: 'pa', salida: 1 },
      { fraccionamiento_id: 7, boton: 1, panel_id: 'pb', salida: 3 },
      { fraccionamiento_id: 8, boton: 2, panel_id: 'otro', salida: 0 },
    ],
    controles_acceso: [
      {
        id: 20,
        domicilio_id: 1,
        control_id: null,
        descripcion: null,
        botones: [
          { boton: 0, rf_code: 111, boton_id: null },
          { boton: 1, rf_code: 222, boton_id: null },
          { boton: 2, rf_code: 333, boton_id: null },
        ],
        ...over,
      },
    ],
  })

  it('crear manda outputs por botón según fraccionamiento_botones y guarda los ids', async () => {
    api.crearControl.mockResolvedValue({
      id: 'c1',
      buttons: [
        { id: 'b0', button: 0, rf_code: 111, outputs: { pa: 1 } },
        { id: 'b1', button: 1, rf_code: 222, outputs: { pb: 3 } },
      ],
    })
    const { db, ctx } = contexto(tablas())
    const t = tarea({ entidad: 'control', entidad_id: 20 })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.crearControl).toHaveBeenCalledWith(
      INST,
      {
        holder_id: 'h1',
        description: '',
        buttons: [
          { id: null, button: 0, rf_code: 111, outputs: { pa: 1 } },
          { id: null, button: 1, rf_code: 222, outputs: { pb: 3 } },
        ],
      },
      t.id,
    )
    expect(db.tablas.controles_acceso[0].control_id).toBe('c1')
    expect(db.tablas.controles_acceso[0].botones).toEqual([
      { boton: 0, rf_code: 111, boton_id: 'b0' },
      { boton: 1, rf_code: 222, boton_id: 'b1' },
      { boton: 2, rf_code: 333, boton_id: null },
    ])
  })

  it('crear no hace nada si el tipo de cuota no permite control', async () => {
    const { db, ctx } = contexto({ ...tablas(), ...permite('tarjeta') })
    expect(await ejecutar(ctx, tarea({ entidad: 'control', entidad_id: 20 }))).toEqual({ ok: true })
    expect(api.crearControl).not.toHaveBeenCalled()
    expect(db.tablas.controles_acceso[0].control_id).toBeNull()
  })

  it('crear falla sin reintento si ningún botón tiene salida', async () => {
    const { ctx } = contexto({ ...tablas(), fraccionamiento_botones: [] })
    const r = await ejecutar(ctx, tarea({ entidad: 'control', entidad_id: 20 }))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error.message).toBe('Ningún botón tiene salida configurada')
    expect(api.crearControl).not.toHaveBeenCalled()
  })

  it('actualizar reemplaza con los boton_id conocidos y descripción vacía', async () => {
    api.reemplazarControl.mockResolvedValue({ id: 'c1', buttons: [{ id: 'b0', button: 0, rf_code: 111, outputs: {} }] })
    const { ctx } = contexto(
      tablas({ control_id: 'c1', botones: [{ boton: 0, rf_code: 111, boton_id: 'b0' }] }),
    )
    const t = tarea({ entidad: 'control', entidad_id: 20, operacion: 'actualizar' })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.reemplazarControl).toHaveBeenCalledWith(
      INST,
      'c1',
      { holder_id: 'h1', description: '', buttons: [{ id: 'b0', button: 0, rf_code: 111, outputs: { pa: 1 } }] },
      t.id,
    )
  })

  it('borrar usa el control_id de la carga', async () => {
    const { ctx } = contexto({ domicilios: [domicilio()], controles_acceso: [] })
    const t = tarea({ entidad: 'control', entidad_id: 20, operacion: 'borrar', carga: { control_id: 'c9' } })
    expect(await ejecutar(ctx, t)).toEqual({ ok: true })
    expect(api.borrarControl).toHaveBeenCalledWith(INST, 'c9', t.id)
  })
})

describe('pin', () => {
  it('fijar lee el PIN de pines_acceso', async () => {
    const { ctx } = contexto({ domicilios: [domicilio()], pines_acceso: [{ domicilio_id: 1, pin: '1234' }] })
    expect(await ejecutar(ctx, tarea({ entidad: 'pin', operacion: 'fijar' }))).toEqual({ ok: true })
    expect(api.fijarPin).toHaveBeenCalledWith(INST, 'h1', '1234')
  })

  it('quitar llama a la API', async () => {
    const { ctx } = contexto({ domicilios: [domicilio()] })
    expect(await ejecutar(ctx, tarea({ entidad: 'pin', operacion: 'quitar' }))).toEqual({ ok: true })
    expect(api.quitarPin).toHaveBeenCalledWith(INST, 'h1')
  })
})
