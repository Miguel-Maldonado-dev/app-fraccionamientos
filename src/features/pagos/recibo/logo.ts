import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

let cache: string | null = null

/** Logotipo WEADMI como data URL PNG; se lee una vez. Nunca lanza: ante un fallo devuelve null. */
export async function cargarLogo(): Promise<string | null> {
  if (cache) return cache
  try {
    const bytes = await readFile(path.join(process.cwd(), 'public/brand/weadmi-logotipo-recibo.png'))
    cache = `data:image/png;base64,${bytes.toString('base64')}`
    return cache
  } catch (error) {
    console.error('No se pudo leer el logotipo del recibo', error)
    return null
  }
}
