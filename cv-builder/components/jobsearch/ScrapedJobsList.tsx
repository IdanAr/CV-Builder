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

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs?profileId=${profileId}`)
      if (!res.ok) {
        setError('Failed to load scraped jobs.')
        return
      }
      const body = await res.json()
      setJobs(body.scrapedJobs)
    } catch {
      setError('Failed to load scraped jobs.')
    }
  }, [profileId])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ProfileList.tsx's load effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

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
        <p className="text-sm text-gray-500">No scraped jobs yet — run a scan to find matches.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => {
            const postedAtLabel = formatPostedAt(job.postedAt)
            return (
              <li key={job._id} className="rounded border px-4 py-2">
                <div className="flex items-center justify-between">
                  {job.url ? (
                    <a href={job.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                      {job.title}
                    </a>
                  ) : (
                    <span className="font-medium">{job.title}</span>
                  )}
                  {job.atsScore !== undefined && <span className="text-sm text-gray-500">{job.atsScore}% fit</span>}
                </div>
                <div className="text-sm text-gray-600">
                  {job.company}
                  {job.location ? ` — ${job.location}` : ''}
                </div>
                {postedAtLabel && <div className="text-xs text-gray-400">{postedAtLabel}</div>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
