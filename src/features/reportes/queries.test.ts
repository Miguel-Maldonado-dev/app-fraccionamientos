import { expect, test } from 'vitest'
import { callsOf, fakeQuery, fakeSupabase } from '@/test/fake-query'
import { listUsuariosReporte } from './queries'

test('listUsuariosReporte filtra por rol administrador y tesorero', async () => {
  const users = fakeQuery({ data: [{ id: 'u1', user_name: 'Ana' }, { id: null, user_name: 'X' }] })
  const supabase = fakeSupabase({ users_info: users })

  const r = await listUsuariosReporte(supabase as never)

  expect(r).toEqual([{ id: 'u1', user_name: 'Ana' }])
  expect(callsOf(users, 'in')[0].args).toEqual(['rol', ['administrador', 'tesorero']])
})
