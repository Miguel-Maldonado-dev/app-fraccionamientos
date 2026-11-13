import * as SecureStore from 'expo-secure-store'

/** Envoltorio de expo-secure-store (también sirve de storage para la sesión de Supabase). */
export const almacen = {
  getItem: (clave: string) => SecureStore.getItemAsync(clave),
  setItem: (clave: string, valor: string) => SecureStore.setItemAsync(clave, valor),
  removeItem: (clave: string) => SecureStore.deleteItemAsync(clave),
}

const TAM_FRAGMENTO = 1800

/**
 * Almacén por fragmentos para la sesión de Supabase: secure store advierte/falla con valores
 * > ~2048 bytes. Guarda `<clave>.0..k-1` y el conteo en `<clave>.n`.
 */
export const almacenFragmentado = {
  async getItem(clave: string): Promise<string | null> {
    const n = Number(await SecureStore.getItemAsync(`${clave}.n`))
    if (!n) return null
    const partes: string[] = []
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(`${clave}.${i}`)
      if (p === null) return null
      partes.push(p)
    }
    return partes.join('')
  },
  async setItem(clave: string, valor: string): Promise<void> {
    await almacenFragmentado.removeItem(clave)
    const n = Math.max(1, Math.ceil(valor.length / TAM_FRAGMENTO))
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${clave}.${i}`, valor.slice(i * TAM_FRAGMENTO, (i + 1) * TAM_FRAGMENTO))
    }
    await SecureStore.setItemAsync(`${clave}.n`, String(n))
  },
  async removeItem(clave: string): Promise<void> {
    const n = Number(await SecureStore.getItemAsync(`${clave}.n`)) || 0
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${clave}.${i}`)
    await SecureStore.deleteItemAsync(`${clave}.n`)
  },
}
