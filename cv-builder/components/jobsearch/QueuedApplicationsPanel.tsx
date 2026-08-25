'use client'

import { useCallback, useEffect, useState } from 'react'

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

  const load = useCallback(async () => {
    try {
      const [jobsRes, profileRes] = await Promise.all([
        fetch(`/api/jobsearch/scraped-jobs?profileId=${profileId}`),
        fetch(`/api/jobsearch/profiles/${profileId}`),
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
    } catch {
      setError('Failed to load queued applications.')
    }
  }, [profileId])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ScrapedJobsList.tsx's load effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
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

  if (jobs === null) {
    return error ? <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null
  }

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No queued drafts yet - postings matched to a &quot;Draft &amp; queue&quot; rule will appear here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <ul className="flex flex-col gap-2">
        {jobs.map((job) => {
          const isExpanded = expandedId === job._id
          const draft = drafts[job._id]
          const reason =
            job.status === 'needs_review'
              ? job.pendingApprovals.length > 0
                ? `Needs your review - unverified: ${job.pendingApprovals.join(', ')}`
                : `Below your ${minAtsScore}% threshold`
              : null

          return (
            <li key={job._id} className="rounded border px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <a href={job.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                    {job.title}
                  </a>
                  <div className="text-sm text-gray-600">
                    {job.company}
                    {job.location ? ` - ${job.location}` : ''}
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    job.status === 'queued' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {job.status === 'queued' ? 'Ready to submit' : 'Needs review'}
                </span>
              </div>

              <div className="mt-2 text-sm text-gray-600">
                Fit score: {job.atsScore ?? '-'}% → {job.postTailorScore ?? '-'}%
              </div>

              {reason && <div className="mt-1 text-xs text-amber-700">{reason}</div>}

              {(job.matchedRules.length > 0 || job.tailoredKeywords.length > 0) && (
                <div className="mt-2 text-xs text-gray-500">
                  {job.matchedRules.length > 0 && <div>Matched: {job.matchedRules.join(', ')}</div>}
                  {job.tailoredKeywords.length > 0 && <div>Keywords added: {job.tailoredKeywords.join(', ')}</div>}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => toggleExpand(job)}>
                  {isExpanded ? 'Hide draft' : 'View draft'}
                </button>
                <button
                  type="button"
                  disabled={job.pendingApprovals.length > 0 || convertingId === job._id}
                  title={job.pendingApprovals.length > 0 ? 'Resolve flagged claims before marking as applied' : undefined}
                  className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-40"
                  onClick={() => handleConvert(job)}
                >
                  {convertingId === job._id ? 'Marking…' : 'Mark as applied'}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-3 rounded bg-gray-50 p-3 text-sm">
                  {draftLoadError && <div className="text-red-700">{draftLoadError}</div>}
                  {!draft && !draftLoadError && <div className="text-gray-500">Loading draft…</div>}
                  {draft && (
                    <>
                      <div className="font-medium">{draft.title}</div>
                      {draft.summary && <p className="mt-1 whitespace-pre-wrap text-gray-700">{draft.summary}</p>}
                      {draft.coverLetter && (
                        <>
                          <div className="mt-2 font-medium">Cover letter</div>
                          <p className="mt-1 whitespace-pre-wrap text-gray-700">{draft.coverLetter}</p>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
