import type { ReactNode } from 'react'
import Link from 'next/link'

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
    <nav className="w-full bg-white/55 backdrop-blur-xl border-b border-white/30 shadow-sm">
      <div className={containerClassName}>
        {/* Added 'relative' and 'w-full' to this wrapper so the absolute logo positions correctly.
            Below md, height is allowed to grow (min-h + py) so a wrapped actions row has room. */}
        <div className="relative flex flex-wrap items-center w-full min-h-[64px] py-2 md:h-20 md:py-0 md:flex-nowrap">

          {/* Actions Container: Now spans the entire width (z-10 to stay clickable above the logo area).
              Wraps below md instead of overflowing — simpler than a collapse-into-menu pattern. */}
          {actions && (
            <div className="flex flex-1 flex-wrap items-center gap-y-2 w-full z-10">
              {actions}
            </div>
          )}

          {/* Absolute Centered Logo + wordmark — links home. */}
          {/* left-1/2 and -translate-x-1/2 perfectly center this element regardless of what is on the left/right.
              z-20 + pointer-events-auto keeps the link clickable in the (empty) center strip above the
              z-10 actions row, while the actions themselves sit on the sides and stay clickable. */}
          <Link
            href={homeHref}
            aria-label="CV Builder home"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 z-20 rounded-lg pointer-events-auto transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 shrink-0">
              <polygon points="50,25 65,35 65,55 50,65 35,55 35,35" fill="#7C3AED" />
              <circle cx="30" cy="30" r="4" fill="#A78BFA" />
              <circle cx="70" cy="30" r="4" fill="#A78BFA" />
              <circle cx="20" cy="50" r="4" fill="#A78BFA" />
              <circle cx="80" cy="50" r="4" fill="#A78BFA" />
              <circle cx="30" cy="70" r="4" fill="#A78BFA" />
              <circle cx="70" cy="70" r="4" fill="#A78BFA" />
              <line x1="30" y1="30" x2="42" y2="38" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="70" y1="30" x2="58" y2="38" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="20" y1="50" x2="35" y2="45" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="80" y1="50" x2="65" y2="45" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="30" y1="70" x2="42" y2="58" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <line x1="70" y1="70" x2="58" y2="58" stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
              <path d="M 42 42 L 48 42 L 50 38 L 52 42 L 58 42 L 54 48 L 56 54 L 50 50 L 44 54 L 46 48 Z"
                fill="#FFFFFF" opacity="0.9" />
            </svg>
            <span className="hidden md:inline text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 whitespace-nowrap">
              CV Builder
            </span>
          </Link>

        </div>
      </div>
    </nav>
  )
}