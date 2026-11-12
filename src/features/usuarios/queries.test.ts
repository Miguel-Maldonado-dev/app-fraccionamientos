import { describe, expect, test } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { listUsuarios } from './queries'

const sb = (q: ReturnType<typeof fakeQuery>) => fakeSupabase({ users_info: q }) as never

describe('listUsuarios', () => {
  test('sin fraccionamiento filtra solo por estado (RLS limita al propio)', async () => {
    const q = fakeQuery({ data: [{ id: 'u1' }] })
    expect(await listUsuarios(sb(q), true)).toEqual([{ id: 'u1' }])
    expect(callsOf(q, 'eq').map((c) => c.args)).toEqual([['is_active', true]])
  })

  test('con fraccionamiento agrega el filtro por fraccionamiento_id', async () => {
    const q = fakeQuery({ data: [] })
    await listUsuarios(sb(q), false, 5)
    expect(callsOf(q, 'eq').map((c) => c.args)).toEqual([
      ['is_active', false],
      ['fraccionamiento_id', 5],
    ])
  })

  test('propaga el error de lectura', async () => {
    await expect(listUsuarios(sb(fakeQuery({ error: { message: 'boom' } })), true)).rejects.toThrow(
      'No se pudieron leer los usuarios: boom',
    )
  })
})
