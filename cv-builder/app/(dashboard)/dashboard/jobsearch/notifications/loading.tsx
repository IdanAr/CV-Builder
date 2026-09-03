import { Skeleton, NavbarSkeleton } from '@/components/ui/Skeleton'

/**
 * Shown while `JobMatchesPage` awaits its unread count. The match cards keep
 * the fit meter's slot on the left, so the column doesn't shift sideways when
 * the real scores arrive.
 */
export default function JobMatchesLoading() {
  return (
    <>
      <NavbarSkeleton />

      <div role="status" aria-live="polite" className="mx-auto max-w-5xl px-4 py-8">
        <span className="sr-only">Loading your job matches</span>

        <div aria-hidden="true" className="mb-6 flex flex-col gap-5">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>

        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
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
                  <Skeleton className="h-[18px] w-32 rounded-full" />
                </div>
              </div>
              <div className="flex gap-2 border-t border-border-subtle pt-2.5">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
