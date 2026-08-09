// components/marketing/MarketingNavActions.tsx
import Link from 'next/link'

/** Shared navbar actions for every public marketing page (homepage, legal pages). */
export function MarketingNavActions() {
  return (
    <div className="flex items-center gap-3 flex-1">
      <Link
        href="/signin"
        className="ml-auto hidden text-sm font-medium text-indigo-700 hover:text-indigo-900 sm:inline"
      >
        Sign In
      </Link>
      <Link
        href="/signin"
        className="ml-auto rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:ml-0"
      >
        Get Started
      </Link>
    </div>
  )
}
