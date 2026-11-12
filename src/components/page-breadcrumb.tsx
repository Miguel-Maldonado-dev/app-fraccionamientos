import { Fragment } from 'react'
import Link from 'next/link'
import { Home } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export type BreadcrumbEntry = { label: string; href?: string }

export function PageBreadcrumb({ items, homeHref = '/' }: { items: BreadcrumbEntry[]; homeHref?: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={homeHref} aria-label="Inicio">
              <Home className="size-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((b) => (
          <Fragment key={`${b.label}-${b.href ?? ''}`}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {b.href ? (
                <BreadcrumbLink asChild>
                  <Link href={b.href}>{b.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{b.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
