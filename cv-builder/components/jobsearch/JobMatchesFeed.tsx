'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/stores/toast.store'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { FitMeter, STRONG_FIT, FAIR_FIT } from './FitMeter'
import { cn } from '@/lib/utils'

interface NotifyMatch {
  _id: string
  profileId: string
  profileName?: string
  title: string
  company: string
  location?: string
  workMode?: string
  matchedRules?: string[]
  url: string
  atsScore?: number
  status: string
  createdAt?: string
}

type Filter = 'all' | 'unread' | 'strong'
type Sort = 'newest' | 'fit'

function dayGroup(iso?: string): string {
  if (!iso) return 'Earlier'
  const then = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const time = then.getTime()
  if (time >= startOfToday) return 'Today'
  if (time >= startOfToday - 86_400_000) return 'Yesterday'
  return 'Earlier'
}

/**
 * Pairs each match with the day header that should precede it, so the header
 * run is computed once rather than by mutating a cursor mid-render.
 *
 * Day headers only make sense while the feed is in date order; sorting by fit
 * deliberately drops them rather than printing "Today" over a run of cards
 * from three different days.
 */
function withDayHeaders(
  matches: NotifyMatch[],
  grouped: boolean
): Array<{ match: NotifyMatch; header: string | null }> {
  let last: string | null = null
  return matches.map((match) => {
    if (!grouped) return { match, header: null }
    const group = dayGroup(match.createdAt)
    const header = group === last ? null : group
    last = group
    return { match, header }
  })
}

interface JobMatchesFeedProps {
  /**
   * Scopes the feed to one profile. Set inside a profile record, where the
   * cross-profile view would be wrong; omitted on the section's own Matches
   * page, which instead offers a profile filter.
   */
  profileId?: string
}

export function JobMatchesFeed({ profileId }: JobMatchesFeedProps = {}) {
  const router = useRouter()
  const [matches, setMatches] = useState<NotifyMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('newest')
  // '' is "every profile". Only offered when the feed is not already scoped.
  const [profileFilter, setProfileFilter] = useState<string>('')
  // Which matches were unread when this page was opened. The mark-read POST
  // below clears 'new' server-side immediately, so without this snapshot the
  // page you reach by clicking the navbar's unread badge shows nothing marked
  // as new — the exact thing the badge was counting.
  //
  // State rather than a ref: it is read during render to decide which cards
  // carry the stripe, and it is written exactly once per load, in the same
  // pass that sets `matches`.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set())

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/jobsearch/notifications', { signal })
      if (!res.ok) {
        setError('Failed to load your job matches.')
        return
      }
      const body = await res.json()
      const all: NotifyMatch[] = body.matches ?? []
      const loaded = profileId ? all.filter((m) => m.profileId === profileId) : all
      setUnreadIds(new Set(loaded.filter((m) => m.status === 'new').map((m) => m._id)))
      setMatches(loaded)
      // Mark unread matches as seen once they've actually been loaded/shown
      // — fire-and-forget, doesn't block rendering the list, and deliberately
      // not tied to the load-abort signal since a real page-unread count
      // shouldn't be undone just because the component unmounted.
      fetch('/api/jobsearch/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Scoped when the feed is: marking the whole account read from inside
        // one profile would clear unread counts the user never looked at.
        body: JSON.stringify(profileId ? { profileId } : {}),
      }).catch(() => {})
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Failed to load your job matches.')
    }
  }, [profileId])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ScrapedJobsList.tsx's load effect.
    // Aborted on unmount so a stale response can't setState on a component
    // that no longer cares.
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function setDismissed(match: NotifyMatch, dismissed: boolean) {
    const res = await fetch(`/api/jobsearch/scraped-jobs/${match._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed }),
    })
    if (!res.ok) throw new Error('Dismiss failed')
  }

  async function handleDismiss(match: NotifyMatch) {
    setDismissingId(match._id)
    try {
      await setDismissed(match, true)
      setMatches((prev) => (prev ? prev.filter((m) => m._id !== match._id) : prev))
      toast.withAction(`Dismissed "${match.title}"`, 'Undo', () => {
        void (async () => {
          try {
            await setDismissed(match, false)
            await load()
          } catch {
            toast.error(`Could not restore "${match.title}".`)
          }
        })()
      })
    } catch {
      setError('Failed to dismiss this match. Please try again.')
    } finally {
      setDismissingId(null)
    }
  }

  // Starts tracking the posting in the applications supertable. No new
  // endpoint: POST /api/applications already takes a company and a role.
  async function handleTrack(match: NotifyMatch) {
    setTrackingId(match._id)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: match.company, role: match.title }),
      })
      if (!res.ok) throw new Error('Track failed')
      router.push('/dashboard/applications')
    } catch {
      setError(`Could not start tracking "${match.title}". Please try again.`)
      setTrackingId(null)
    }
  }

  const visible = useMemo(() => {
    if (!matches) return []
    const filtered = matches.filter((match) => {
      if (profileFilter && match.profileId !== profileFilter) return false
      if (filter === 'unread') return unreadIds.has(match._id)
      if (filter === 'strong') return (match.atsScore ?? 0) >= STRONG_FIT
      return true
    })
    // The API already sorts newest-first, so 'newest' is the identity order.
    if (sort === 'fit') {
      return [...filtered].sort((a, b) => (b.atsScore ?? -1) - (a.atsScore ?? -1))
    }
    return filtered
  }, [matches, filter, sort, unreadIds, profileFilter])

  const profileOptions = useMemo(() => {
    if (profileId || !matches) return []
    const byId = new Map<string, string>()
    for (const match of matches) {
      if (!byId.has(match.profileId)) {
        byId.set(match.profileId, match.profileName ?? 'Unnamed profile')
      }
    }
    return [...byId].map(([id, name]) => ({ id, name }))
  }, [matches, profileId])

  const rows = useMemo(() => withDayHeaders(visible, sort === 'newest'), [visible, sort])

  if (error && matches === null) {
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

  if (matches === null) return null

  const unreadCount = matches.filter((m) => unreadIds.has(m._id)).length
  const filters: Array<{ key: Filter; label: string; count?: number }> = [
    { key: 'all', label: 'All', count: matches.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'strong', label: 'Strong fit' },
  ]


  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {matches.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter matches"
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
                {entry.count !== undefined && entry.count > 0 && (
                  <span className="tabular-nums opacity-70">{entry.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profileOptions.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
                Profile
                <select
                  value={profileFilter}
                  onChange={(e) => setProfileFilter(e.target.value)}
                  className="rounded-control border border-border bg-surface/60 px-2 py-1 text-xs font-medium text-fg-body focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All profiles</option>
                  {profileOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-control border border-border bg-surface/60 px-2 py-1 text-xs font-medium text-fg-body focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="newest">Newest</option>
              <option value="fit">Best fit</option>
            </select>
            </label>
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <Card
          tone="outline"
          padding="lg"
          className="flex flex-col items-center gap-2 border-dashed py-10 text-center"
        >
          <p className="font-semibold text-fg-heading">Nothing has matched yet</p>
          <p className="max-w-sm text-sm text-fg-subtle">
            {profileId
              ? 'Matches land here when this profile finds a job that satisfies one of its notify rules.'
              : 'Matches land here when a scan finds a job that satisfies one of your notify rules.'}
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">
          No matches under this filter.
        </p>
      ) : (
        <ul aria-live="polite" className="flex flex-col gap-2">
          {rows.map(({ match, header }) => {
            const isDismissing = dismissingId === match._id
            const isTracking = trackingId === match._id
            const isUnread = unreadIds.has(match._id)

            // A weak match hides the primary action rather than disabling it,
            // which keeps the strong ones visually louder.
            const worthTracking = (match.atsScore ?? 100) >= FAIR_FIT

            const meta = [
              match.location,
              match.workMode,
              match.createdAt ? formatRelativeTime(match.createdAt) : null,
            ].filter(Boolean) as string[]

            return (
              <li key={match._id} className="flex flex-col gap-2">
                {header && (
                  <h2 className="mt-2 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle first:mt-0">
                    {header}
                    <span aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
                  </h2>
                )}

                <Card
                  className={cn(
                    'relative flex flex-col gap-2.5 overflow-hidden transition hover:border-input',
                    isUnread && 'border-border bg-surface/90 pl-[15px]'
                  )}
                >
                  {isUnread && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-[3px] bg-primary"
                    />
                  )}

                  <div className="flex gap-3.5">
                    {match.atsScore !== undefined && <FitMeter score={match.atsScore} />}

                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {match.url ? (
                          <a
                            href={match.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-fg-body hover:underline"
                          >
                            {match.title}
                            <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="font-semibold text-fg-heading">{match.title}</span>
                        )}
                        {isUnread && (
                          <Badge className="bg-primary text-primary-fg">New</Badge>
                        )}
                      </div>

                      <p className="text-xs text-fg-subtle">
                        <span className="font-medium text-fg-body">{match.company}</span>
                        {meta.map((item) => (
                          <span key={item}> · {item}</span>
                        ))}
                      </p>

                      {(match.matchedRules?.length || match.profileName) && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {match.matchedRules?.map((rule) => (
                            <Badge key={rule}>Matched “{rule}”</Badge>
                          ))}
                          {match.profileName && (
                            <Badge tone="neutral">{match.profileName}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
                    {worthTracking && (
                      <Button
                        disabled={isTracking}
                        onClick={() => handleTrack(match)}
                      >
                        {isTracking ? 'Starting…' : 'Track this application'}
                      </Button>
                    )}
                    {match.url && (
                      <a
                        href={match.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-8 items-center rounded-control border border-border bg-surface/50 px-3 py-1.5 text-sm font-medium text-fg-body transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Open posting
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      disabled={isDismissing}
                      className="ml-auto"
                      onClick={() => handleDismiss(match)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
