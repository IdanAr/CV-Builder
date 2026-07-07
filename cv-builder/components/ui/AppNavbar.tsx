import type { ReactNode } from 'react'

interface AppNavbarProps {
  actions?: ReactNode
}

export function AppNavbar({ actions }: AppNavbarProps) {
  return (
    <nav className="w-full bg-white/55 backdrop-blur-xl border-b border-white/30 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
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

          {/* Absolute Centered Logo + wordmark */}
          {/* left-1/2 and -translate-x-1/2 perfectly center this element regardless of what is on the left/right */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 z-0 pointer-events-none">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="h-18 w-18 shrink-0">
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
          </div>

        </div>
      </div>
    </nav>
  )
}