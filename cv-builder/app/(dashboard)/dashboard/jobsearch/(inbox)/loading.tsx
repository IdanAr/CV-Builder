import { Skeleton } from '@/components/ui/Skeleton'

/** Shown while `JobSearchPage` awaits its profiles, counts and first page of jobs. */
export default function JobSearchLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <span className="sr-only">Loading your pipeline</span>

      <div aria-hidden="true" className="flex flex-col gap-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
          <div className="hidden flex-col gap-3 rounded-card border border-border bg-surface p-6 lg:flex">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-9 w-48" />
          </div>
        </div>
      </div>
    </div>
  )
}
