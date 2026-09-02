import Link from 'next/link'
import { buttonClasses } from '@/components/ui/Button'

/**
 * The app's 404.
 *
 * `resumes/[id]/page.tsx` calls `notFound()` both for a résumé that does not
 * exist and for one belonging to another account — and with no `not-found.tsx`
 * anywhere, both landed on Next's unstyled default page, which looks like the
 * application has crashed rather than like a link that no longer resolves.
 *
 * Deliberately says nothing about *why* the résumé is missing: giving the same
 * response for "deleted" and "belongs to someone else" is what stops this page
 * from confirming that a given résumé ID exists.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold text-fg-muted">404</p>
        <h1 className="mt-2 text-2xl font-bold text-fg-heading">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-sm text-fg-body">
          The link may be out of date, or the CV may have been deleted.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/dashboard" className={buttonClasses({ size: 'md' })}>
            Back to my CVs
          </Link>
          <Link href="/" className={buttonClasses({ variant: 'secondary', size: 'md' })}>
            Homepage
          </Link>
        </div>
      </div>
    </main>
  )
}
