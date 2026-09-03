'use client'

import { useCallback, useEffect, useState } from 'react'

interface ScrapedJobSummary {
  _id: string
  title: string
  company: string
  url: string
  location?: string
  atsScore?: number
  status: string
  /** The posting's original publish date (first time it was seen live), not when we scraped it. */
  postedAt?: string
}

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

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs?profileId=${profileId}`, { signal })
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

  async function handleToggleDismissed(job: ScrapedJobSummary) {
    setUpdatingId(job._id)
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: job.status !== 'dismissed' }),
      })
      if (!res.ok) {
        setError('Failed to update the listing. Please try again.')
        return
      }
      await load()
    } catch {
      setError('Failed to update the listing. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(job: ScrapedJobSummary) {
    if (!window.confirm(`Delete "${job.title}"? This can't be undone.`)) return
    setUpdatingId(job._id)
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Failed to delete the listing. Please try again.')
        return
      }
      await load()
    } catch {
      setError('Failed to delete the listing. Please try again.')
    } finally {
      setUpdatingId(null)
    }
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

  // Only fully replace the view with an error screen when the very first
  // load failed and there's nothing to show yet. Once jobs have loaded
  // successfully, a later failed reload/scan shows an inline banner above
  // the still-intact list instead — mirrors ProfileList.tsx's convention.
  if (error && jobs === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        <button
          type="button"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white"
          onClick={() => {
            setError(null)
            load()
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  if (jobs === null) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={scanning}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40"
          onClick={handleScan}
        >
          {scanning ? 'Scanning…' : 'Scan now'}
        </button>
      </div>
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {jobs.length === 0 ? (
        <p className="text-sm text-gray-500">No scraped jobs yet - run a scan to find matches.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => {
            const postedAtLabel = formatPostedAt(job.postedAt)
            const isDismissed = job.status === 'dismissed'
            const isSubmitted = job.status === 'submitted'
            const isUpdating = updatingId === job._id
            return (
              <li key={job._id} className={`rounded border px-4 py-2 ${isDismissed ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {job.url ? (
                      <a href={job.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                        {job.title}
                      </a>
                    ) : (
                      <span className="font-medium">{job.title}</span>
                    )}
                    {isDismissed && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Non-Active</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {job.atsScore !== undefined && <span className="text-sm text-gray-500">{job.atsScore}% fit</span>}
                    {!isSubmitted && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        className="rounded border px-2 py-0.5 text-xs disabled:opacity-40"
                        onClick={() => handleToggleDismissed(job)}
                      >
                        {isDismissed ? 'Restore' : 'Dismiss'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isUpdating}
                      className="rounded border px-2 py-0.5 text-xs text-red-700 disabled:opacity-40"
                      onClick={() => handleDelete(job)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {job.company}
                  {job.location ? ` - ${job.location}` : ''}
                </div>
                {postedAtLabel && <div className="text-xs text-fg-subtle">{postedAtLabel}</div>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
