import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import { almacenFragmentado } from './almacen'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, anonKey, {
  auth: { storage: almacenFragmentado, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
})

// Renovación automática solo con la app en primer plano (recomendación de Supabase para RN).
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
