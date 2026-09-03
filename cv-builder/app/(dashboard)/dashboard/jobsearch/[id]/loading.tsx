import { Skeleton, NavbarSkeleton } from '@/components/ui/Skeleton'

/**
 * Shown while the profile page awaits its profile, unread count and scraped
 * jobs. All four panels below it used to render `null` while fetching, so the
 * page arrived as an empty column and filled in four separate jumps.
 */
export default function JobSearchProfileLoading() {
  return (
    <>
      <NavbarSkeleton />

      <div role="status" aria-live="polite" className="mx-auto max-w-5xl px-4 py-8">
        <span className="sr-only">Loading this job search profile</span>

        <div aria-hidden="true" className="mb-6 flex flex-col gap-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>

        {/* Two sections stand in for the four: enough to hold the scroll
            position without pretending to know how long each list is. */}
        <div aria-hidden="true" className="flex flex-col gap-8">
          {Array.from({ length: 2 }, (_, section) => (
            <div key={section} className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              {Array.from({ length: 2 }, (_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2.5 rounded-card border border-border-subtle bg-surface/70 p-4 backdrop-blur-sm"
                >
                  <div className="flex gap-3.5">
                    <div className="flex w-11 shrink-0 flex-col items-center gap-1.5">
                      <Skeleton className="h-5 w-8" />
                      <Skeleton className="h-[3px] w-full" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-56 max-w-full" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-border-subtle pt-2.5">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
