'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { RoleName } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { navItemsPara, type VarianteShell } from './nav-items'

function isActive(pathname: string, href: string) {
  // Los inicios ('/' y '/admin') solo están activos en coincidencia exacta.
  return href === '/' || href === '/admin' ? pathname === href : pathname.startsWith(href)
}

export function NavList({
  roleName,
  variante,
  onNavigate,
}: {
  roleName: RoleName | null
  variante: VarianteShell
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items = navItemsPara(variante, roleName)
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map(({ label, href, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? "bg-primary-light text-primary before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-r before:bg-brand-primary before:content-[''] [&_svg]:text-brand-primary"
                : 'text-brand-navy hover:bg-muted [&_svg]:text-secondary-foreground',
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
