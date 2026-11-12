import { KeyRound, Settings } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { navItemsPara, visibleNavItems } from './nav-items'

const LABELS = [
  'Inicio',
  'Domicilios',
  'Residentes',
  'Accesos',
  'Cuotas',
  'Pagos',
  'Movimientos Financieros',
  'Reportes',
  'Usuarios',
  'Configuración',
]

describe('visibleNavItems', () => {
  it('Comite ve 7 ítems sin /usuarios, /configuracion ni /accesos', () => {
    const items = visibleNavItems('comite')
    expect(items).toHaveLength(7)
    expect(items.map((i) => i.href)).not.toContain('/accesos')
    expect(items.map((i) => i.href)).not.toContain('/usuarios')
    expect(items.map((i) => i.href)).not.toContain('/configuracion')
  })

  it('Tesorero ve Accesos con KeyRound', () => {
    const item = visibleNavItems('tesorero').find((i) => i.href === '/accesos')
    expect(item?.label).toBe('Accesos')
    expect(item?.icon).toBe(KeyRound)
  })

  it('Administrador ve 10 ítems en el orden esperado', () => {
    const items = visibleNavItems('administrador')
    expect(items).toHaveLength(10)
    expect(items.map((i) => i.label)).toEqual(LABELS)
  })

  it('Configuración usa el ícono de engrane', () => {
    const item = visibleNavItems('administrador').find((i) => i.href === '/configuracion')
    expect(item?.icon).toBe(Settings)
  })

  it('sin rol ve solo los ítems públicos', () => {
    expect(visibleNavItems(null)).toHaveLength(7)
  })
})

describe('navItemsPara', () => {
  it('plataforma devuelve Inicio y Fraccionamientos', () => {
    expect(navItemsPara('plataforma', null).map((i) => [i.label, i.href])).toEqual([
      ['Inicio', '/admin'],
      ['Fraccionamientos', '/admin/fraccionamientos'],
    ])
  })

  it('fraccionamiento devuelve los ítems según el rol', () => {
    expect(navItemsPara('fraccionamiento', 'comite')).toHaveLength(7)
  })
})
