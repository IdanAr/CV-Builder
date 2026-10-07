import Link from 'next/link'

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm font-medium text-primary">
          CV Builder
        </span>
        <p className="text-sm text-fg-muted">&copy; {new Date().getFullYear()} CV Builder. All rights reserved.</p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <Link href="/privacy" className="inline-flex min-h-10 items-center rounded-chip text-sm font-medium text-fg-body underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0">
            Privacy Policy
          </Link>
          <Link href="/terms" className="inline-flex min-h-10 items-center rounded-chip text-sm font-medium text-fg-body underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0">
            Terms of Use
          </Link>
          <Link href="/signin" className="inline-flex min-h-10 items-center rounded-chip text-sm font-medium text-fg-body underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0">
            Sign In
          </Link>
        </nav>
      </div>
    </footer>
  )
}
