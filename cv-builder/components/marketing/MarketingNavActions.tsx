// components/marketing/MarketingNavActions.tsx
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/Button'

interface MarketingNavActionsProps {
  /** Signed-in visitors get a single "Dashboard" link instead of Sign In / Get Started. */
  isSignedIn?: boolean
}

/** Shared navbar actions for every public marketing page (homepage, legal pages). */
export function MarketingNavActions({ isSignedIn = false }: MarketingNavActionsProps) {
  if (isSignedIn) {
    return (
      <div className="flex items-center gap-3 flex-1">
        <Link
          href="/dashboard"
          className={buttonClasses({ variant: 'primary', size: 'md', className: 'ml-auto' })}
        >
          Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-1">
      <Link
        href="/signin"
        className={buttonClasses({ variant: 'link', size: 'md', className: 'ml-auto hidden sm:inline-flex' })}
      >
        Sign In
      </Link>
      <Link
        href="/signin"
        className={buttonClasses({ variant: 'primary', size: 'md', className: 'ml-auto sm:ml-0' })}
      >
        Get Started
      </Link>
    </div>
  )
}
