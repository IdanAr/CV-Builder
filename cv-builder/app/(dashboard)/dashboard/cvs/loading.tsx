import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Shown while the CV library awaits its database calls. The app shell (the
 * group layout) stays mounted around it, so unlike the old dashboard loading
 * state there is no navbar stand-in here.
 *
 * The shapes mirror the real page: the heading and its two buttons, the count
 * and view toggle, then table rows in the same two-track/six-track grid.
 */
export default function CvsLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl px-4 py-8">
      <span className="sr-only">Loading your CVs</span>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div aria-hidden="true" className="rounded-card border border-border bg-surface">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-t border-border-subtle px-4 py-4 first:border-t-0 md:grid-cols-[minmax(0,2.4fr)_1fr_0.7fr_1fr_1.3fr_auto]"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="hidden h-4 w-16 md:block" />
            <Skeleton className="hidden h-4 w-10 md:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="hidden h-5 w-16 md:block" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
