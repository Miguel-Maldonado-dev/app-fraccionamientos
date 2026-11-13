/** Logo WEADMI para los PDF generados en el navegador (exportaciones). */
export const LOGO_PDF = '/brand/weadmi-logotipo-recibo.png'

/** Carga el logo en el navegador como data URL; `null` si falla (el PDF sale sin logo). */
export async function cargarLogo(url: string = LOGO_PDF): Promise<string | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const blob = await r.blob()
    return await new Promise<string | null>((ok) => {
      const lector = new FileReader()
      lector.onload = () => ok(typeof lector.result === 'string' ? lector.result : null)
      lector.onerror = () => ok(null)
      lector.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
