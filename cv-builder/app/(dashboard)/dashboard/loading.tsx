import { Skeleton, NavbarSkeleton } from '@/components/ui/Skeleton'

/**
 * Shown while `DashboardPage` awaits its three database calls.
 *
 * Until now there was no `loading.tsx` anywhere in the app, so this wait
 * rendered nothing but the page's background gradient — indistinguishable
 * from a page that had failed to load.
 *
 * The shapes mirror the real page (max-w-4xl column, one heading, a stack of
 * résumé cards) so that content arriving swaps in place rather than shifting
 * the layout.
 */
export default function DashboardLoading() {
  return (
    <>
      <NavbarSkeleton />

      {/* One polite announcement for the whole route. The individual bars are
          aria-hidden, so a screen reader hears "Loading your CVs" once rather
          than a stream of meaningless shapes. */}
      <div role="status" aria-live="polite" className="mx-auto max-w-4xl px-4 py-8">
        <span className="sr-only">Loading your CVs</span>

        <div className="mb-6">
          <Skeleton className="h-8 w-40" />
        </div>

        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="rounded-card border border-white/30 bg-surface/65 p-4 shadow-lg backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
