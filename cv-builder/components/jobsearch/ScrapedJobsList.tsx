'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { useScrapedJobsSync, notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'
import { FitMeter } from './FitMeter'
import { cn } from '@/lib/utils'

const UNDO_DELETE_DURATION = 6000

interface ScrapedJobSummary {
  _id: string
  title: string
  company: string
  url: string
  location?: string
  atsScore?: number
  status: string
  /** Present once a draft_and_queue rule has tailored a resume for this
   *  posting. Deleting the posting deletes that resume too, so the toast has
   *  to say so. */
  draftResumeId?: string
  /** The posting's original publish date (first time it was seen live), not when we scraped it. */
  postedAt?: string
  /** Present once the posting has been deleted. The row survives only as a dedup
   *  key so scans stop re-finding it; it never appears outside the Deleted filter. */
  deletedAt?: string
}

type Filter = 'active' | 'dismissed' | 'all' | 'deleted'

function formatPostedAt(postedAt: string | undefined): string | null {
  if (!postedAt) return null
  const date = new Date(postedAt)
  if (Number.isNaN(date.valueOf())) return null
  return `Posted ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
}

interface ScrapedJobsListProps {
  profileId: string
}

export function ScrapedJobsList({ profileId }: ScrapedJobsListProps) {
  const [jobs, setJobs] = useState<ScrapedJobSummary[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  // id -> pending DELETE timer. A job in here is hidden but not yet deleted
  // server-side, so the undo toast can still call it back.
  const deleteTimersRef = useRef(new Map<string, number>())
  // Reload whenever anything mutates a scraped job — including the queued panel
  // next to this list, which shares the collection but not this component's state.
  const revision = useScrapedJobsSync((state) => state.revision)
  const lastRevisionRef = useRef(revision)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      // includeDeleted so the Deleted filter can count and list tombstones
      // without a second round trip; they are partitioned out below.
      const res = await fetch(`/api/jobsearch/scraped-jobs?profileId=${profileId}&includeDeleted=1`, { signal })
      if (!res.ok) {
        setError('Failed to load scraped jobs.')
        return
      }
      const body = await res.json()
      setJobs(body.scrapedJobs)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Failed to load scraped jobs.')
    }
  }, [profileId])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ProfileList.tsx's load effect.
    // Aborted on unmount/profileId-change so a stale response can't setState
    // on a component that no longer cares.
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // A pending deletion must still happen if the user navigates away before the
  // undo window closes — otherwise the row reappears on the next visit.
  useEffect(() => {
    const timers = deleteTimersRef.current
    return () => {
      for (const [id, timer] of timers) {
        window.clearTimeout(timer)
        void fetch(`/api/jobsearch/scraped-jobs/${id}`, { method: 'DELETE' })
      }
      timers.clear()
    }
  }, [])

  async function setDismissed(job: ScrapedJobSummary, dismissed: boolean) {
    const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed }),
    })
    if (!res.ok) throw new Error('Update failed')
  }

  // Dismissing moves a job out of the default "Active" filter rather than
  // greying it in place, which is what let the list grow unreadable over
  // successive scans. Because the row leaves the view, the toast is the
  // feedback — and the way back.
  useEffect(() => {
    // Seeded from the revision at mount, so this never duplicates the mount fetch
    // (and never fires just because an earlier mutation left the counter non-zero).
    if (revision === lastRevisionRef.current) return
    lastRevisionRef.current = revision
    void load()
  }, [revision, load])

  async function handleToggleDismissed(job: ScrapedJobSummary) {
    const dismissing = job.status !== 'dismissed'
    setUpdatingId(job._id)
    setError(null)
    try {
      await setDismissed(job, dismissing)
      // Announce rather than reload directly: the effect above re-reads this
      // list, and the queued panel re-reads its own.
      notifyScrapedJobsChanged()
      if (dismissing) {
        toast.withAction(`Dismissed "${job.title}"`, 'Undo', () => {
          void (async () => {
            try {
              await setDismissed(job, false)
              notifyScrapedJobsChanged()
            } catch {
              toast.error(`Could not restore "${job.title}".`)
            }
          })()
        })
      }
    } catch {
      setError('Failed to update the listing. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Drops the tombstone so the scanner can pick the posting up again. It cannot
  // bring back the description or the deleted draft résumé, so the Deleted view
  // says as much rather than calling this an undo.
  async function handleFindAgain(job: ScrapedJobSummary) {
    setUpdatingId(job._id)
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: false }),
      })
      if (!res.ok) throw new Error('Restore failed')
      notifyScrapedJobsChanged()
      toast.success(`"${job.title}" will be picked up by the next scan.`)
    } catch {
      setError('Could not restore the listing. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Optimistic delete with a 6s undo window, replacing the window.confirm()
  // this used to open — the same treatment a résumé or a profile already gets.
  // The DELETE also removes any résumé drafted for this posting (see
  // deleteScrapedJob), which is why it waits out the undo window rather than
  // firing straight away.
  function handleDelete(job: ScrapedJobSummary) {
    setError(null)
    setJobs((prev) => (prev ? prev.filter((j) => j._id !== job._id) : prev))

    const commit = () => {
      deleteTimersRef.current.delete(job._id)
      void (async () => {
        try {
          const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Delete failed')
          // The row was dropped optimistically, but the server kept a tombstone
          // this list has never seen. Without this the Deleted filter stays
          // absent until the page is reloaded.
          notifyScrapedJobsChanged()
        } catch {
          toast.error(`Could not delete "${job.title}". It has been restored.`)
          await load()
        }
      })()
    }

    const timer = window.setTimeout(commit, UNDO_DELETE_DURATION)
    deleteTimersRef.current.set(job._id, timer)

    const toastId = toast.withAction(
      job.draftResumeId
        ? `Deleted "${job.title}" and its tailored résumé`
        : `Deleted "${job.title}"`,
      'Undo',
      () => {
        const pending = deleteTimersRef.current.get(job._id)
        if (pending !== undefined) {
          window.clearTimeout(pending)
          deleteTimersRef.current.delete(job._id)
        }
        void load()
      }
    )
    window.setTimeout(() => useToastStore.getState().dismiss(toastId), UNDO_DELETE_DURATION)
  }

  async function handleScan() {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/jobsearch/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      })
      const body = await res.json()
      if (body.result?.degraded) {
        setError(body.result.errorMessage ?? 'Scan failed. Please try again.')
      } else if (!res.ok) {
        setError('Scan failed. Please try again.')
      }
      await load()
    } catch {
      setError('Scan failed. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  const counts = useMemo(() => {
    const all = jobs ?? []
    // Tombstones are excluded from every live count — they are a dedup record,
    // not something the user still has in this profile.
    const live = all.filter((j) => !j.deletedAt)
    const dismissed = live.filter((j) => j.status === 'dismissed').length
    return {
      all: live.length,
      dismissed,
      active: live.length - dismissed,
      deleted: all.length - live.length,
    }
  }, [jobs])

  const visible = useMemo(() => {
    if (!jobs) return []
    if (filter === 'deleted') return jobs.filter((j) => j.deletedAt)
    const live = jobs.filter((j) => !j.deletedAt)
    if (filter === 'dismissed') return live.filter((j) => j.status === 'dismissed')
    if (filter === 'active') return live.filter((j) => j.status !== 'dismissed')
    return live
  }, [jobs, filter])

  // Only fully replace the view with an error screen when the very first
  // load failed and there's nothing to show yet. Once jobs have loaded
  // successfully, a later failed reload/scan shows an inline banner above
  // the still-intact list instead — mirrors ProfileList.tsx's convention.
  if (error && jobs === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <ErrorBanner>{error}</ErrorBanner>
        <Button
          size="md"
          onClick={() => {
            setError(null)
            load()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (jobs === null) return null

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
    { key: 'all', label: 'All', count: counts.all },
    // Only offered once something has actually been deleted — an always-present
    // empty tab would be noise in the common case.
    ...(counts.deleted > 0
      ? [{ key: 'deleted' as Filter, label: 'Deleted', count: counts.deleted }]
      : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {jobs.length > 0 ? (
          <div
            role="group"
            aria-label="Filter scraped jobs"
            className="inline-flex gap-0.5 rounded-control border border-border-subtle bg-surface/60 p-0.5"
          >
            {filters.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={filter === entry.key}
                onClick={() => setFilter(entry.key)}
                className={cn(
                  'inline-flex min-h-6 items-center gap-1.5 rounded-[0.375rem] px-3 py-1 text-xs font-medium transition',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  filter === entry.key
                    ? 'bg-primary text-primary-fg'
                    : 'text-fg-subtle hover:bg-surface-subtle hover:text-fg-body'
                )}
              >
                {entry.label}
                {entry.count > 0 && <span className="tabular-nums opacity-70">{entry.count}</span>}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <Button size="md" disabled={scanning} onClick={handleScan}>
          {scanning ? 'Scanning…' : 'Scan now'}
        </Button>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {jobs.length === 0 ? (
        <Card
          tone="outline"
          padding="lg"
          className="flex flex-col items-center gap-2 border-dashed py-10 text-center"
        >
          <p className="font-semibold text-fg-heading">No scraped jobs yet</p>
          <p className="max-w-sm text-sm text-fg-subtle">
            Run a scan to find matches. Whatever this profile turns up will be listed here, with
            its fit score against your résumé.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">No jobs under this filter.</p>
      ) : (
        <>
          {filter === 'deleted' && (
            <p className="text-xs text-fg-subtle">
              Scans skip these, so they are never tailored again. &quot;Find again&quot; lets the next
              scan pick one back up and draft it from scratch — the old draft is gone.
            </p>
          )}
        <ul aria-live="polite" className="flex flex-col gap-2">
          {visible.map((job) => {
            const postedAtLabel = formatPostedAt(job.postedAt)
            const isDismissed = job.status === 'dismissed'
            const isSubmitted = job.status === 'submitted'
            const isDeleted = Boolean(job.deletedAt)
            const isUpdating = updatingId === job._id
            return (
              <li key={job._id}>
                <Card
                  className={cn(
                    'flex flex-col gap-2.5 transition',
                    isDismissed || isDeleted ? 'opacity-60' : 'hover:border-input'
                  )}
                >
                  <div className="flex gap-3.5">
                    {job.atsScore !== undefined && <FitMeter score={job.atsScore} />}

                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {job.url ? (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-fg-body hover:underline"
                          >
                            {job.title}
                            <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="font-semibold text-fg-heading">{job.title}</span>
                        )}
                        {isDeleted && <Badge tone="neutral">Deleted</Badge>}
                        {isDismissed && !isDeleted && <Badge tone="neutral">Non-Active</Badge>}
                        {isSubmitted && !isDeleted && <Badge tone="success">Submitted</Badge>}
                      </div>

                      <p className="text-xs text-fg-subtle">
                        <span className="font-medium text-fg-body">{job.company}</span>
                        {job.location && <span> · {job.location}</span>}
                        {postedAtLabel && <span> · {postedAtLabel}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
                    {isDeleted ? (
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled={isUpdating}
                        onClick={() => handleFindAgain(job)}
                      >
                        Find again
                      </Button>
                    ) : (
                      <>
                        {!isSubmitted && (
                          <Button
                            variant="secondary"
                            size="xs"
                            disabled={isUpdating}
                            onClick={() => handleToggleDismissed(job)}
                          >
                            {isDismissed ? 'Restore' : 'Dismiss'}
                          </Button>
                        )}
                        <Button
                          variant="dangerGhost"
                          size="xs"
                          className="ml-auto"
                          disabled={isUpdating}
                          onClick={() => handleDelete(job)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
        </>
      )}
    </div>
  )
}
