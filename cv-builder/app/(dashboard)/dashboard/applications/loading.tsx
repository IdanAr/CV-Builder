import { Skeleton, NavbarSkeleton } from '@/components/ui/Skeleton'

/**
 * Shown while `ApplicationsPage` awaits applications, board config and résumé
 * options together.
 *
 * A segment inherits its parent's `loading.tsx`, so without this file the
 * dashboard's "My CVs" skeleton — a narrow max-w-4xl column of cards — would
 * appear on the way to a max-w-7xl table, and the layout would jump twice.
 */
export default function ApplicationsLoading() {
  return (
    <>
      <NavbarSkeleton />

      <div role="status" aria-live="polite" className="mx-auto max-w-7xl px-4 py-8">
        <span className="sr-only">Loading your applications</span>

        <div className="mb-6 space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-96 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>

        <div aria-hidden="true" className="mt-6 space-y-3">
          {/* Toolbar: view switch, filters, add. */}
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="ml-auto h-8 w-36" />
          </div>

          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface/70 backdrop-blur-sm">
            {/* Header row, then body rows — the repeated column widths are what
                make this read as a table rather than as a paragraph. */}
            <div className="flex gap-4 border-b border-border-subtle px-4 py-3">
              {['w-40', 'w-32', 'w-24', 'w-28'].map((w) => (
                <Skeleton key={w} className={`h-4 ${w}`} />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="flex gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
