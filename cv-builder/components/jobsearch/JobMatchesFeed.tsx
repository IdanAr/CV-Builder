'use client'

import { useCallback, useEffect, useState } from 'react'

interface NotifyMatch {
  _id: string
  profileId: string
  title: string
  company: string
  location?: string
  url: string
  atsScore?: number
  status: string
}

export function JobMatchesFeed() {
  const [matches, setMatches] = useState<NotifyMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jobsearch/notifications')
      if (!res.ok) {
        setError('Failed to load your job matches.')
        return
      }
      const body = await res.json()
      setMatches(body.matches)
      // Mark unread matches as seen once they've actually been loaded/shown
      // — fire-and-forget, doesn't block rendering the list.
      fetch('/api/jobsearch/notifications/mark-read', { method: 'POST' }).catch(() => {})
    } catch {
      setError('Failed to load your job matches.')
    }
  }, [])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ScrapedJobsList.tsx's load effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function handleDismiss(match: NotifyMatch) {
    setDismissingId(match._id)
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs/${match._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
      if (!res.ok) {
        setError('Failed to dismiss this match. Please try again.')
        return
      }
      setMatches((prev) => (prev ? prev.filter((m) => m._id !== match._id) : prev))
    } catch {
      setError('Failed to dismiss this match. Please try again.')
    } finally {
      setDismissingId(null)
    }
  }

  if (error && matches === null) {
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

  if (matches === null) return null

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {matches.length === 0 ? (
        <p className="text-sm text-gray-500">
          No job matches yet — they&apos;ll show up here once a scan finds one that matches one of your notify rules.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((match) => {
            const isDismissing = dismissingId === match._id
            return (
              <li key={match._id} className="rounded border px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {match.url ? (
                      <a href={match.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                        {match.title}
                      </a>
                    ) : (
                      <span className="font-medium">{match.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {match.atsScore !== undefined && <span className="text-sm text-gray-500">{match.atsScore}% fit</span>}
                    <button
                      type="button"
                      disabled={isDismissing}
                      className="rounded border px-2 py-0.5 text-xs disabled:opacity-40"
                      onClick={() => handleDismiss(match)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {match.company}
                  {match.location ? ` — ${match.location}` : ''}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
