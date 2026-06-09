import type { ReactNode } from 'react'

interface AppNavbarProps {
  actions?: ReactNode
}

export function AppNavbar({ actions }: AppNavbarProps) {
  return (
    <nav className="w-full bg-white/55 backdrop-blur-xl border-b border-white/30 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 shrink-0">
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
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              CV Builder
            </span>
          </div>

          {/* Right-side actions */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
