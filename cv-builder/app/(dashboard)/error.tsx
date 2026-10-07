'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { buttonClasses } from '@/components/ui/Button'

/**
 * Error boundary for every authenticated route.
 *
 * `app/(dashboard)/layout.tsx` renders every page inside the app shell.
 * `EditorErrorBoundary` only guards individual editor panels several levels
 * below that, so before this file existed any client-side throw from the
 * layout itself — or from a page with no boundary of its own — fell through to
 * Next's default error screen with no way back into the app.
 *
 * Next.js remounts the segment when `reset()` is called, which is enough to
 * recover from a transient failure without a full page load.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <Card padding="lg" className="max-w-md">
        <h1 className="text-xl font-medium text-fg-heading">Something went wrong</h1>
        <p className="mt-2 text-sm text-fg-body">
          This page didn&apos;t load correctly. Your saved CVs and applications are unaffected.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-fg-muted">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className={buttonClasses({ size: 'md' })}>
            Try again
          </button>
          <Link href="/dashboard" className={buttonClasses({ variant: 'secondary', size: 'md' })}>
            Back to dashboard
          </Link>
        </div>
      </Card>
    </div>
  )
}
