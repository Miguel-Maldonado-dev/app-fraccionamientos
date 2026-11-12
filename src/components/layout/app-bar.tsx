import { Avatar } from '@/components/avatar'
import { BrandLogo } from '@/components/brand-logo'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MobileNav } from './mobile-nav'
import { rolShell, subtituloShell, type ShellUser } from './sidebar-content'

export function AppBar({ user }: { user: ShellUser }) {
  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6 lg:px-8">
      <MobileNav user={user} />
      <p className="hidden truncate font-heading text-base font-semibold text-brand-navy sm:block">{subtituloShell(user)}</p>
      <div className="sm:hidden">
        <BrandLogo variant="isotipo" width={32} />
      </div>
      <div className="ml-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Usuario: ${user.userName}`}
                className="inline-flex size-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Avatar name={user.userName} size="sm" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {user.userName} · {rolShell(user) ?? 'Sin rol'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  )
}
