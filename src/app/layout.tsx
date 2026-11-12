import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/sonner'
import { PRODUCTO } from '@/lib/constants'
import './globals.css'

// Inter va incluida en el proyecto (subconjunto latin, fuente variable 100–900): con
// next/font/google la compilación descarga la fuente y falla si no hay red (p. ej. en Vercel).
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
})

// Sora (títulos): fuente variable local, subconjunto latin, pesos 600–800.
const sora = localFont({
  src: './fonts/sora-latin-wght-normal.woff2',
  variable: '--font-heading',
  weight: '600 800',
  display: 'swap',
})

export const metadata: Metadata = {
  title: PRODUCTO,
  description: 'WEADMI · Gestión residencial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  )
}
