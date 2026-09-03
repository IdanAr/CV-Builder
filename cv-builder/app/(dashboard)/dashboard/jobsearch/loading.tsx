import { Skeleton, NavbarSkeleton } from '@/components/ui/Skeleton'

/**
 * Shown while `JobSearchPage` awaits its profiles and unread count.
 *
 * Without this the section fell back to the dashboard's "My CVs" skeleton on
 * the way to a different layout, and `ProfileList` itself rendered `null`
 * while fetching — so a slow load and an account with no profiles looked
 * exactly alike.
 */
export default function JobSearchLoading() {
  return (
    <>
      <NavbarSkeleton />

      <div role="status" aria-live="polite" className="mx-auto max-w-5xl px-4 py-8">
        <span className="sr-only">Loading your job search profiles</span>

        <div aria-hidden="true" className="mb-6 flex flex-col gap-5">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>

        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-card border border-border-subtle bg-surface/70 p-4 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
              {/* The chip run is what makes this read as a profile card rather
                  than as a paragraph. */}
              <div className="flex gap-1">
                {['w-20', 'w-14', 'w-24', 'w-16'].map((w) => (
                  <Skeleton key={w} className={`h-[18px] ${w} rounded-full`} />
                ))}
              </div>
              <div className="flex justify-between gap-3 border-t border-border-subtle pt-2.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
