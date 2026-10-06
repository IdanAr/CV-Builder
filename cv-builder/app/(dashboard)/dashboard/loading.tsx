import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Shown while `DashboardPage` awaits its data. Mirrors the Overview sections
 * (greeting, pipeline strip, needs-you, recent CVs). No navbar skeleton: the
 * shell stays on screen.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-5xl px-4 py-8">
      <span className="sr-only">Loading your overview</span>

      <Skeleton className="mb-6 h-7 w-56" />

      <div className="flex flex-col gap-8">
        <div>
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-card" />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="mb-3 h-5 w-36" />
          <Skeleton className="h-24 rounded-card" />
        </div>
        <div>
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="h-36 rounded-card" />
        </div>
      </div>
    </div>
  )
}
