import { create } from 'zustand'

/**
 * A change signal for scraped jobs, shared by every consumer of the collection.
 *
 * The pipeline inbox (its actions and its list) and the sidebar's stage count
 * read overlapping slices of the same data: dismissing, deleting, approving or
 * marking a posting applied in the inbox changes what the sidebar badge and the
 * other stages should show. Without a signal they would keep rendering what
 * they fetched on mount until the page is reloaded.
 *
 * Deliberately just a counter rather than a cache of the jobs themselves:
 * "something changed, re-read" costs one GET and keeps each consumer the owner
 * of its own query.
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
