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
          {jobs.map((job) => (
            <li key={job._id} className="rounded border px-4 py-2">
              <div className="flex items-center justify-between">
                <a href={job.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                  {job.title}
                </a>
                {job.atsScore !== undefined && <span className="text-sm text-gray-500">{job.atsScore}% fit</span>}
              </div>
              <div className="text-sm text-gray-600">
                {job.company}
                {job.location ? ` — ${job.location}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
