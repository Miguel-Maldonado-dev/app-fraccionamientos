import { PageBreadcrumb, type BreadcrumbEntry } from './page-breadcrumb'

export function PageHeader({
  title,
  description,
  breadcrumbs,
  homeHref,
  actions,
}: {
  title: string
  description?: string
  breadcrumbs: BreadcrumbEntry[]
  /** Destino del icono de inicio; la consola del super admin usa `/admin`. */
  homeHref?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2">
        <PageBreadcrumb items={breadcrumbs} homeHref={homeHref} />
        <h1 className="font-heading text-[26px] font-bold tracking-tight text-brand-navy md:text-[32px]">{title}</h1>
        {description && <p className="text-[15px] text-secondary-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-col gap-2 sm:flex-row [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>
      )}
    </div>
  )
}
