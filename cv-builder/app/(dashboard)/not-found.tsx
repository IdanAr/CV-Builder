import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { buttonClasses } from '@/components/ui/Button'

/**
 * The 404 for authenticated routes. Lives inside the dashboard layout, so the
 * app shell stays around it (the root `app/not-found.tsx` replaces the shell).
 *
 * Deliberately says nothing about *why* the item is missing: giving the same
 * response for "deleted" and "belongs to someone else" is what stops this page
 * from confirming that a given ID exists.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <Card padding="lg" className="max-w-md">
        <h1 className="text-xl font-medium text-fg-heading">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm text-fg-body">
          The link may be out of date, or the item may have been deleted.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard" className={buttonClasses({ size: 'md' })}>
            Back to dashboard
          </Link>
        </div>
      </Card>
    </div>
  )
}
