'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonClasses } from '@/components/ui/Button'
import { toast } from '@/lib/stores/toast.store'
import { FitMeter } from './FitMeter'

interface QueuedJobSummary {
  _id: string
  title: string
  company: string
  location?: string
  url: string
  atsScore?: number
  postTailorScore?: number
  status: 'queued' | 'needs_review'
  matchedRules: string[]
  tailoredKeywords: string[]
  pendingApprovals: string[]
  draftResumeId?: string
}

interface DraftPreview {
  title: string
  summary?: string
  coverLetter?: string
}

interface QueuedApplicationsPanelProps {
  profileId: string
}

export function QueuedApplicationsPanel({ profileId }: QueuedApplicationsPanelProps) {
  const [jobs, setJobs] = useState<QueuedJobSummary[] | null>(null)
  const [minAtsScore, setMinAtsScore] = useState<number>(75)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftPreview>>({})
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [jobsRes, profileRes] = await Promise.all([
        fetch(`/api/jobsearch/scraped-jobs?profileId=${profileId}`, { signal }),
        fetch(`/api/jobsearch/profiles/${profileId}`, { signal }),
      ])
      if (!jobsRes.ok || !profileRes.ok) {
        setError('Failed to load queued applications.')
        return
      }
      const jobsBody = await jobsRes.json()
      const profileBody = await profileRes.json()
      const queued = (jobsBody.scrapedJobs as QueuedJobSummary[]).filter(
        (j) => j.status === 'queued' || j.status === 'needs_review'
      )
      setJobs(queued)
      setMinAtsScore(profileBody.profile?.minAtsScore ?? 75)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Failed to load queued applications.')
    }
  }, [profileId])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ScrapedJobsList.tsx's load effect.
    // Aborted on unmount/profileId-change so a stale response can't setState
    // on a component that no longer cares.
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function toggleExpand(job: QueuedJobSummary) {
    if (expandedId === job._id) {
      setExpandedId(null)
      return
    }
    setExpandedId(job._id)
    setDraftLoadError(null)
    if (!job.draftResumeId || drafts[job._id]) return
    try {
      const res = await fetch(`/api/resumes/${job.draftResumeId}`)
      if (!res.ok) {
        setDraftLoadError('Failed to load the tailored draft.')
        return
      }
      const body = await res.json()
      setDrafts((prev) => ({
        ...prev,
        [job._id]: {
          title: body.resume.title,
          summary: body.resume.data?.basics?.summary,
          coverLetter: body.resume.data?.coverLetter,
        },
      }))
    } catch {
      setDraftLoadError('Failed to load the tailored draft.')
    }
  }

  async function handleConvert(job: QueuedJobSummary) {
    setConvertingId(job._id)
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}/convert`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to mark as applied.')
        return
      }
      await load()
    } catch {
      setError('Failed to mark as applied.')
    } finally {
      setConvertingId(null)
    }
  }

  async function handleApprove(job: QueuedJobSummary) {
    setActioningId(job._id)
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}/approve`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to approve the flagged claims.')
        return
      }
      await load()
    } catch {
      setError('Failed to approve the flagged claims.')
    } finally {
      setActioningId(null)
    }
  }

  async function setDismissed(job: QueuedJobSummary, dismissed: boolean) {
    const res = await fetch(`/api/jobsearch/scraped-jobs/${job._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed }),
    })
    if (!res.ok) throw new Error('Reject failed')
  }

  // Rejecting used to open a window.confirm(). It now takes effect at once and
  // offers an undo, matching how every other destructive action in the section
  // behaves — a modal that interrupts every rejection is the wrong trade when
  // the action is this reversible.
  async function handleReject(job: QueuedJobSummary) {
    setActioningId(job._id)
    setError(null)
    try {
      await setDismissed(job, true)
      await load()
      toast.withAction(`Rejected "${job.title}"`, 'Undo', () => {
        void (async () => {
          try {
            await setDismissed(job, false)
            await load()
          } catch {
            toast.error(`Could not restore "${job.title}".`)
          }
        })()
      })
    } catch {
      setError('Failed to reject the posting. Please try again.')
    } finally {
      setActioningId(null)
    }
  }

  if (jobs === null) {
    return error ? <ErrorBanner>{error}</ErrorBanner> : null
  }

  if (jobs.length === 0) {
    return (
      <Card
        tone="outline"
        padding="lg"
        className="flex flex-col items-center gap-2 border-dashed py-10 text-center"
      >
        <p className="font-semibold text-fg-heading">No queued drafts yet</p>
        <p className="max-w-sm text-sm text-fg-subtle">
          Postings matched to a &quot;Draft &amp; queue&quot; rule land here with a tailored
          résumé already written, ready for you to review.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <ul aria-live="polite" className="flex flex-col gap-2">
        {jobs.map((job) => {
          const isExpanded = expandedId === job._id
          const draft = drafts[job._id]
          const reason =
            job.status === 'needs_review'
              ? job.pendingApprovals.length > 0
                ? `Needs your review - unverified: ${job.pendingApprovals.join(', ')}`
                : `Below your ${minAtsScore}% threshold`
              : null
          const isBlocked = job.pendingApprovals.length > 0
          // The meter shows where the draft landed; the delta beneath says how
          // far tailoring moved it.
          const headlineScore = job.postTailorScore ?? job.atsScore

          return (
            <li key={job._id}>
              <Card className="flex flex-col gap-2.5">
                <div className="flex gap-3.5">
                  {headlineScore !== undefined && <FitMeter score={headlineScore} />}

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-fg-body hover:underline"
                      >
                        {job.title}
                        <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                      </a>
                      <Badge tone={job.status === 'queued' ? 'success' : 'warning'}>
                        {job.status === 'queued' ? 'Ready to submit' : 'Needs review'}
                      </Badge>
                    </div>

                    <p className="text-xs text-fg-subtle">
                      <span className="font-medium text-fg-body">{job.company}</span>
                      {job.location && <span> · {job.location}</span>}
                    </p>

                    <p className="text-xs text-fg-subtle">
                      <span className="font-medium tabular-nums text-fg-body">
                        {job.atsScore ?? '-'}% → {job.postTailorScore ?? '-'}%
                      </span>{' '}
                      after tailoring
                    </p>

                    {reason && <p className="text-xs font-medium text-fg-warning">{reason}</p>}

                    {(job.matchedRules.length > 0 || job.tailoredKeywords.length > 0) && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {job.matchedRules.map((rule) => (
                          <Badge key={`rule-${rule}`}>Matched “{rule}”</Badge>
                        ))}
                        {job.tailoredKeywords.map((keyword) => (
                          <Badge key={`kw-${keyword}`} tone="neutral">
                            + {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
                  <Button
                    disabled={isBlocked || convertingId === job._id}
                    title={
                      isBlocked ? 'Resolve flagged claims before marking as applied' : undefined
                    }
                    onClick={() => handleConvert(job)}
                  >
                    {convertingId === job._id ? 'Marking…' : 'Mark as applied'}
                  </Button>

                  <Button variant="secondary" onClick={() => toggleExpand(job)}>
                    {isExpanded ? 'Hide draft' : 'View draft'}
                  </Button>

                  {job.draftResumeId && (
                    <a
                      href={`/dashboard/resumes/${job.draftResumeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClasses({ variant: 'secondary' })}
                    >
                      Open resume
                    </a>
                  )}

                  {job.status === 'needs_review' && (
                    <>
                      {isBlocked && (
                        <Button
                          variant="soft"
                          disabled={actioningId === job._id}
                          title="Confirm the flagged claims are accurate (or that you've fixed them in the draft)"
                          onClick={() => handleApprove(job)}
                        >
                          {actioningId === job._id ? 'Approving…' : 'Approve'}
                        </Button>
                      )}
                      <Button
                        variant="dangerGhost"
                        className="ml-auto"
                        disabled={actioningId === job._id}
                        onClick={() => handleReject(job)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div className="rounded-control bg-surface-subtle p-3 text-sm">
                    {draftLoadError && <ErrorBanner>{draftLoadError}</ErrorBanner>}
                    {!draft && !draftLoadError && (
                      <p className="text-fg-subtle">Loading draft…</p>
                    )}
                    {draft && (
                      <>
                        <p className="font-semibold text-fg-heading">{draft.title}</p>
                        {draft.summary && (
                          <p className="mt-1 whitespace-pre-wrap text-fg-body">{draft.summary}</p>
                        )}
                        {draft.coverLetter && (
                          <>
                            <p className="mt-2 font-semibold text-fg-heading">Cover letter</p>
                            <p className="mt-1 whitespace-pre-wrap text-fg-body">
                              {draft.coverLetter}
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
