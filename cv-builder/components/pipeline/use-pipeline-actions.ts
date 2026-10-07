'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'
import type { JobActionId } from '@/lib/jobsearch/job-actions'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'

export const UNDO_DELETE_DURATION = 6000

export interface PipelineActionsDeps {
  /** Hide the row immediately (usePipelineJobs.removeLocal). */
  removeLocal(id: string): void
  /** Re-read page 1 (usePipelineJobs.reload). */
  reload(): Promise<void>
  /** Navigation for open-cv / open-applications (router.push). */
  navigate(href: string): void
}

export interface UsePipelineActions {
  busyId: string | null
  error: string | null
  clearError(): void
  /** Dispatches to the methods below; open-posting is NOT handled here (it is a link). */
  run(action: JobActionId, job: PipelineJob): void
  dismiss(job: PipelineJob): Promise<void>
  restoreDismissed(job: PipelineJob): Promise<void>
  findAgain(job: PipelineJob): Promise<void>
  /** Optimistic delete with the undo window. */
  remove(job: PipelineJob): void
  approve(job: PipelineJob): Promise<void>
  markApplied(job: PipelineJob): Promise<void>
  track(job: PipelineJob): Promise<void>
}

const jobUrl = (id: string) => `/api/jobsearch/scraped-jobs/${id}`

async function patch(id: string, body: Record<string, boolean>): Promise<void> {
  const res = await fetch(jobUrl(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Update failed')
}

export function usePipelineActions(deps: PipelineActionsDeps): UsePipelineActions {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // id -> pending DELETE timer. A job in here is hidden but not yet deleted
  // server-side, so the undo toast can still call it back.
  const deleteTimersRef = useRef(new Map<string, number>())
  const depsRef = useRef(deps)
  useEffect(() => {
    depsRef.current = deps
  })

  // A pending deletion must still happen if the user navigates away before the
  // undo window closes — otherwise the row reappears on the next visit.
  useEffect(() => {
    const timers = deleteTimersRef.current
    return () => {
      for (const [id, timer] of timers) {
        window.clearTimeout(timer)
        void fetch(jobUrl(id), { method: 'DELETE' })
      }
      timers.clear()
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  /** Runs an async action with busy/error bookkeeping. */
  const guarded = useCallback(
    async (id: string, fn: () => Promise<void>, onError: () => void) => {
      setBusyId(id)
      setError(null)
      try {
        await fn()
      } catch {
        onError()
      } finally {
        setBusyId(null)
      }
    },
    []
  )

  const dismiss = useCallback(
    async (job: PipelineJob) => {
      setBusyId(job._id)
      setError(null)
      depsRef.current.removeLocal(job._id)
      try {
        await patch(job._id, { dismissed: true })
        notifyScrapedJobsChanged()
        toast.withAction(`Dismissed "${job.title}"`, 'Undo', () => {
          void (async () => {
            try {
              await patch(job._id, { dismissed: false })
              notifyScrapedJobsChanged()
            } catch {
              toast.error(`Could not restore "${job.title}".`)
            }
          })()
        })
      } catch {
        void depsRef.current.reload()
        setError('Failed to dismiss the posting. Please try again.')
      } finally {
        setBusyId(null)
      }
    },
    []
  )

  const restoreDismissed = useCallback(
    (job: PipelineJob) =>
      guarded(
        job._id,
        async () => {
          await patch(job._id, { dismissed: false })
          notifyScrapedJobsChanged()
        },
        () => setError('Failed to update the listing. Please try again.')
      ),
    [guarded]
  )

  // Drops the tombstone so the scanner can pick the posting up again. It cannot
  // bring back the description or the deleted draft résumé.
  const findAgain = useCallback(
    (job: PipelineJob) =>
      guarded(
        job._id,
        async () => {
          await patch(job._id, { deleted: false })
          notifyScrapedJobsChanged()
          toast.success(`"${job.title}" will be picked up by the next scan.`)
        },
        () => setError('Could not restore the listing. Please try again.')
      ),
    [guarded]
  )

  // Optimistic delete with a 6s undo window. The DELETE also removes any résumé
  // drafted for this posting, which is why it waits out the undo window.
  const remove = useCallback((job: PipelineJob) => {
    setError(null)
    depsRef.current.removeLocal(job._id)

    const commit = () => {
      deleteTimersRef.current.delete(job._id)
      void (async () => {
        try {
          const res = await fetch(jobUrl(job._id), { method: 'DELETE' })
          if (!res.ok) throw new Error('Delete failed')
          notifyScrapedJobsChanged()
        } catch {
          toast.error(`Could not delete "${job.title}". It has been restored.`)
          await depsRef.current.reload()
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
        void depsRef.current.reload()
      }
    )
    window.setTimeout(() => useToastStore.getState().dismiss(toastId), UNDO_DELETE_DURATION)
  }, [])

  const postAction = useCallback(
    (job: PipelineJob, path: 'approve' | 'convert', fallback: string) =>
      guarded(
        job._id,
        async () => {
          const res = await fetch(`${jobUrl(job._id)}/${path}`, { method: 'POST' })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            setError((body as { error?: string }).error ?? fallback)
            // A 409 means the row is stale; re-read the list.
            void depsRef.current.reload()
            return
          }
          notifyScrapedJobsChanged()
        },
        () => setError(fallback)
      ),
    [guarded]
  )

  const approve = useCallback(
    (job: PipelineJob) => postAction(job, 'approve', 'Failed to approve the flagged claims.'),
    [postAction]
  )
  const markApplied = useCallback(
    (job: PipelineJob) => postAction(job, 'convert', 'Failed to mark as applied.'),
    [postAction]
  )

  const track = useCallback(
    (job: PipelineJob) =>
      guarded(
        job._id,
        async () => {
          const res = await fetch('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: job.company, role: job.title }),
          })
          if (!res.ok) throw new Error('Track failed')
          toast.withAction(`Now tracking "${job.title}"`, 'View', () =>
            depsRef.current.navigate('/dashboard/applications')
          )
        },
        () => setError(`Could not start tracking "${job.title}". Please try again.`)
      ),
    [guarded]
  )

  const run = useCallback(
    (action: JobActionId, job: PipelineJob) => {
      switch (action) {
        case 'approve': void approve(job); break
        case 'mark-applied': void markApplied(job); break
        case 'dismiss': void dismiss(job); break
        case 'restore': void restoreDismissed(job); break
        case 'find-again': void findAgain(job); break
        case 'track': void track(job); break
        case 'delete': remove(job); break
        case 'open-cv':
          if (job.draftResumeId) depsRef.current.navigate(`/dashboard/resumes/${job.draftResumeId}`)
          break
        case 'open-applications': depsRef.current.navigate('/dashboard/applications'); break
        case 'open-posting': break
      }
    },
    [approve, markApplied, dismiss, restoreDismissed, findAgain, track, remove]
  )

  return { busyId, error, clearError, run, dismiss, restoreDismissed, findAgain, remove, approve, markApplied, track }
}
