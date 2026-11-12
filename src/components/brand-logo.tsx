import Image from 'next/image'

const LOGOTIPO = { src: '/brand/weadmi-logotipo.png', w: 1047, h: 217 }

/** Logo oficial de WEADMI: solo los PNG de la marca, con su proporción (logotipo 1047:217, isotipo 1:1). */
export function BrandLogo({
  variant = 'logotipo',
  width,
  subtitulo,
  preload,
}: {
  variant?: 'logotipo' | 'isotipo'
  width: number
  /** Nombre del fraccionamiento, bajo el logotipo. */
  subtitulo?: string
  preload?: boolean
}) {
  const isotipo = variant === 'isotipo'
  const height = isotipo ? width : Math.round((width * LOGOTIPO.h) / LOGOTIPO.w)
  const image = (
    <Image
      src={isotipo ? '/brand/weadmi-isotipo.png' : LOGOTIPO.src}
      alt="WEADMI"
      width={width}
      height={height}
      preload={preload}
      className="shrink-0"
    />
  )
  if (!subtitulo) return image
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {image}
      <span className="truncate text-[13px] font-medium leading-tight text-secondary-foreground">{subtitulo}</span>
    </div>
  )
}
