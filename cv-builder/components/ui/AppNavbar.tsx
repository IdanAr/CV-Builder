import type { ReactNode } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/ui/BrandLogo'

interface AppNavbarProps {
  actions?: ReactNode
  /**
   * Constrains the navbar's *content* (actions + logo) to a centered column so
   * it lines up with the page's content below. Pass the same container classes
   * the page uses (e.g. "mx-auto max-w-7xl px-4"). The bar itself always spans
   * full width; only its contents are centered. Defaults to full-width padding.
   */
  containerClassName?: string
  /**
   * Destination for the logo/wordmark link. Defaults to "/dashboard" for the
   * app's authenticated pages. Pass "/" on the public marketing homepage so
   * signed-out visitors clicking the logo stay on "/" instead of bouncing
   * through the dashboard auth wall.
   */
  homeHref?: string
}

export function AppNavbar({
  actions,
  containerClassName = 'w-full px-4 sm:px-6 lg:px-8',
  homeHref = '/dashboard',
}: AppNavbarProps) {
  return (
    <nav aria-label="Primary" className="w-full border-b border-border bg-surface">
      <div className={containerClassName}>
        {/* Added 'relative' and 'w-full' to this wrapper so the absolute logo positions correctly.
            Below md, height is allowed to grow (min-h + py) so a wrapped actions row has room. */}
        <div className="relative flex flex-wrap items-center w-full min-h-[64px] py-2 md:h-16 md:py-0 md:flex-nowrap">

          {/* Actions Container: Now spans the entire width (z-10 to stay clickable above the logo area).
              Wraps below md instead of overflowing — simpler than a collapse-into-menu pattern. */}
          {actions && (
            <div className="flex flex-1 flex-wrap items-center gap-y-2 w-full z-10">
              {actions}
            </div>
          )}

          {/* Absolute centered wordmark tile + name — links home. */}
          {/* left-1/2 and -translate-x-1/2 perfectly center this element regardless of what is on the left/right.
              z-20 + pointer-events-auto keeps the link clickable in the (empty) center strip above the
              z-10 actions row, while the actions themselves sit on the sides and stay clickable. */}
          <Link
            href={homeHref}
            aria-label="CVitae Studio home"
            className="order-first mr-auto flex items-center gap-2 rounded-control pointer-events-auto transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:absolute md:left-1/2 md:top-1/2 md:order-none md:mr-0 md:-translate-x-1/2 md:-translate-y-1/2 md:z-20"
          >
            {/* Compact mark below md, full lockup from md up. */}
            <BrandLogo variant="mark" alt="" className="h-8 shrink-0 md:hidden" />
            <BrandLogo alt="" className="hidden h-8 shrink-0 md:block" />
          </Link>

        </div>
      </div>
    </nav>
  )
}