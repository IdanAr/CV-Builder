import { create } from 'zustand'

/**
 * A change signal for scraped jobs, shared by the two lists that render them.
 *
 * QueuedApplicationsPanel and ScrapedJobsList are sibling client components on
 * the profile page with no state between them, but they read overlapping slices
 * of the same collection: dismissing, deleting or submitting a posting in one
 * changes what the other should show. Without a signal, the second list keeps
 * rendering what it fetched on mount until the page is reloaded — which is how
 * a freshly created tombstone could exist server-side while the "Deleted" filter
 * still reported none.
 *
 * Deliberately just a counter rather than a cache of the jobs themselves. The
 * two lists want different queries (one filters to queued/needs_review, the
 * other paginates every status), so sharing fetched data would mean reconciling
 * two shapes; sharing "something changed, re-read" costs one GET and keeps each
 * list the owner of its own query.
 */
interface ScrapedJobsSyncState {
  /** Bumped on every mutation. Consumers reload when it changes. */
  revision: number
  notifyScrapedJobsChanged: () => void
}

export const useScrapedJobsSync = create<ScrapedJobsSyncState>((set) => ({
  revision: 0,
  notifyScrapedJobsChanged: () => set((state) => ({ revision: state.revision + 1 })),
}))

/** Callable outside React (timer callbacks, async commits) — same store. */
export function notifyScrapedJobsChanged(): void {
  useScrapedJobsSync.getState().notifyScrapedJobsChanged()
}
