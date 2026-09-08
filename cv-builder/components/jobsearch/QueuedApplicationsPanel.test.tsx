// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueuedApplicationsPanel } from './QueuedApplicationsPanel'
import { useToastStore } from '@/lib/stores/toast.store'
import { useScrapedJobsSync } from '@/lib/stores/scraped-jobs.store'

const profile = { profile: { _id: 'p1', minAtsScore: 75 } }

const queuedJob = {
  _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
  atsScore: 60, postTailorScore: 90, status: 'queued',
  matchedRules: [], resolvedActions: ['draft_and_queue'],
  tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

beforeEach(() => {
  useScrapedJobsSync.setState({ revision: 0 })
  useToastStore.setState({ toasts: [] })
  vi.stubGlobal('fetch', vi.fn())
})

describe('QueuedApplicationsPanel', () => {
  it('shows an empty state when there are no queued or needs_review jobs', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [{ _id: 'j1', title: 'X', company: 'Y', status: 'new' } ] }))
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    expect(await screen.findByText(/no queued drafts yet/i)).toBeInTheDocument()
  })

  it('renders a queued job with its before/after fit score', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 88, status: 'queued',
            matchedRules: ['High fit'], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: ['Node'], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText(/60.*88/)).toBeInTheDocument()
    expect(screen.getByText('Ready to submit')).toBeInTheDocument()
  })

  it('shows the below-threshold reason for a needs_review job with no pending approvals', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 68, status: 'needs_review',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    expect(await screen.findByText(/below your 75% threshold/i)).toBeInTheDocument()
  })

  it('disables "Mark as applied" while pendingApprovals is non-empty', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 90, status: 'needs_review',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: ['40%'], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    const button = await screen.findByRole('button', { name: /mark as applied/i })
    expect(button).toBeDisabled()
  })

  it('enables "Mark as applied" and converts the job when there are no pending approvals', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 90, status: 'queued',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    mockFetch.mockResolvedValueOnce(jsonResponse({ application: { _id: 'app1' } }))
    mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [] }))
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    const button = await screen.findByRole('button', { name: /mark as applied/i })
    expect(button).not.toBeDisabled()
    await userEvent.click(button)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1/convert', { method: 'POST' }))
  })

  it('lazily loads and displays the tailored draft (summary and cover letter) on "View draft"', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 90, status: 'queued',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        resume: { title: 'Backend Engineer at Acme (tailored)', data: { basics: { summary: 'Tailored summary.' }, coverLetter: 'Dear Acme, ...' } },
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: /view draft/i }))

    expect(await screen.findByText('Tailored summary.')).toBeInTheDocument()
    expect(screen.getByText('Dear Acme, ...')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith('/api/resumes/r1')
  })

  it('clears a stale draft-load error from a previously-viewed job when switching to another job', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 90, status: 'queued',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
          {
            _id: 'j2', title: 'Frontend Engineer', company: 'Beta', url: 'https://x/j2',
            atsScore: 65, postTailorScore: 92, status: 'queued',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r2',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    // Job j1's draft fetch fails.
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false))
    // Job j2's draft fetch succeeds.
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        resume: { title: 'Frontend Engineer at Beta (tailored)', data: { basics: { summary: 'Beta summary.' }, coverLetter: 'Dear Beta, ...' } },
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    const viewDraftButtons = await screen.findAllByRole('button', { name: /view draft/i })
    expect(viewDraftButtons).toHaveLength(2)

    // Expand job j1 — its draft fetch fails, showing the error banner.
    await userEvent.click(viewDraftButtons[0])
    expect(await screen.findByText(/failed to load the tailored draft/i)).toBeInTheDocument()

    // Collapse job j1.
    await userEvent.click(await screen.findByRole('button', { name: /hide draft/i }))

    // Expand job j2 — its draft loads successfully; j1's stale error must not linger.
    const viewDraftButtonsAfterCollapse = await screen.findAllByRole('button', { name: /view draft/i })
    await userEvent.click(viewDraftButtonsAfterCollapse[1])

    expect(await screen.findByText('Beta summary.')).toBeInTheDocument()
    expect(screen.queryByText(/failed to load the tailored draft/i)).not.toBeInTheDocument()
  })

  it('links "Open resume" to the draft resume in a new tab', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 90, status: 'queued',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    const link = await screen.findByRole('link', { name: /open resume/i })
    expect(link).toHaveAttribute('href', '/dashboard/resumes/r1')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows Approve for a needs_review job with pending approvals, and approving clears them', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 90, status: 'needs_review',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: ['40%'], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'queued' }))
    mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [] }))
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: /^approve$/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1/approve', { method: 'POST' })
    )
  })

  it('omits Approve (nothing to clear) when needs_review is purely a score shortfall', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 68, status: 'needs_review',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    await screen.findByText('Backend Engineer')
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument()
  })

  it('dismisses a job without touching its draft, offering an undo instead of a confirm dialog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 68, status: 'needs_review',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [] }))
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: /more actions for backend engineer/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /dismiss, keep the draft/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
    )
    // Nothing was DELETEd: the tailored resume survives a dismissal.
    expect(mockFetch).not.toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1', { method: 'DELETE' })
    // Nothing interrupted the dismissal, and it is reversible from the toast.
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)).toMatchObject({ actionLabel: 'Undo' })
    )
  })

  it('offers dismiss and delete on a "queued" job too, but never Approve', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        scrapedJobs: [
          {
            _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/j1',
            atsScore: 60, postTailorScore: 90, status: 'queued',
            matchedRules: [], resolvedActions: ['draft_and_queue'],
            tailoredKeywords: [], pendingApprovals: [], draftResumeId: 'r1',
          },
        ],
      })
    )
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    await screen.findByText('Backend Engineer')
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /more actions for backend engineer/i }))
    expect(await screen.findByRole('menuitem', { name: /dismiss, keep the draft/i })).toBeInTheDocument()
    // The label says what goes with it, so the resume never disappears unannounced.
    expect(screen.getByRole('menuitem', { name: /delete with its résumé/i })).toBeInTheDocument()
  })

  it('removes the card at once and defers the delete for the length of the undo window', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [queuedJob] }))
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    vi.stubGlobal('fetch', mockFetch)

    render(<QueuedApplicationsPanel profileId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: /more actions for backend engineer/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete with its résumé/i }))

    await waitFor(() => expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument())
    // Still only the two mount GETs — nothing is deleted while the undo stands,
    // which is what keeps the résumé recoverable.
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // The toast says the résumé goes too, so it never disappears unannounced.
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      message: 'Deleted "Backend Engineer" and its tailored résumé',
      actionLabel: 'Undo',
    })
  })

  it('commits the pending DELETE when the panel unmounts before the undo window closes', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [queuedJob] }))
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, deletedDraftResume: true }))
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<QueuedApplicationsPanel profileId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: /more actions for backend engineer/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete with its résumé/i }))
    await waitFor(() => expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument())

    unmount()

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/scraped-jobs/j1',
        expect.objectContaining({ method: 'DELETE' })
      )
    )
  })

  it('cancels the delete — and so spares the résumé — when the undo is taken', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [queuedJob] }))
    mockFetch.mockResolvedValueOnce(jsonResponse(profile))
    mockFetch.mockResolvedValue(jsonResponse({ scrapedJobs: [queuedJob] }))
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<QueuedApplicationsPanel profileId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: /more actions for backend engineer/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete with its résumé/i }))
    await waitFor(() => expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument())

    useToastStore.getState().toasts.at(-1)!.onAction!()

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    unmount()
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/jobsearch/scraped-jobs/j1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('aborts the mount-time fetches on unmount', async () => {
    let capturedSignal: AbortSignal | undefined
    const mockFetch = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).startsWith('/api/jobsearch/scraped-jobs?')) {
        capturedSignal = init?.signal as AbortSignal | undefined
        return new Promise<Response>(() => {}) // never resolves
      }
      return Promise.resolve(jsonResponse(profile))
    })
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<QueuedApplicationsPanel profileId="p1" />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal!.aborted).toBe(false)

    unmount()

    expect(capturedSignal!.aborted).toBe(true)
  })

  it('does not show an error banner when profileId changes while fetches are in flight', async () => {
    const mockFetch = vi.fn((url: string) => {
      if (String(url).includes('p1')) {
        return new Promise<Response>(() => {}) // never resolves — simulates the stale in-flight requests
      }
      return Promise.resolve({ ok: true, json: async () => ({ scrapedJobs: [], profile: { minAtsScore: 75 } }) } as Response)
    })
    vi.stubGlobal('fetch', mockFetch)

    const { rerender } = render(<QueuedApplicationsPanel profileId="p1" />)
    rerender(<QueuedApplicationsPanel profileId="p2" />)

    await screen.findByText(/no queued drafts yet/i)
    expect(screen.queryByText(/failed to load queued applications/i)).not.toBeInTheDocument()
  })

  // ScrapedJobsList renders the same collection beside this panel and holds no
  // state in common with it, so a delete here has to announce itself or that
  // list keeps showing what it fetched on mount until the page is reloaded.
  it('announces the change once the delete commits, so the list beside it re-reads', async () => {
    vi.useFakeTimers()
    try {
      // fireEvent rather than userEvent: userEvent's timer coordination deadlocks
      // against vi's fake clock. Radix opens the menu on pointerdown.
      const mockFetch = vi.fn()
      mockFetch.mockResolvedValueOnce(jsonResponse({ scrapedJobs: [queuedJob] }))
      mockFetch.mockResolvedValueOnce(jsonResponse(profile))
      mockFetch.mockResolvedValue(jsonResponse({ ok: true, deletedDraftResume: true }))
      vi.stubGlobal('fetch', mockFetch)

      render(<QueuedApplicationsPanel profileId="p1" />)
      await act(async () => {})

      fireEvent.pointerDown(
        screen.getByRole('button', { name: /more actions for backend engineer/i }),
        { button: 0, ctrlKey: false, pointerType: 'mouse' }
      )
      await act(async () => {})
      fireEvent.click(screen.getByRole('menuitem', { name: /delete with its résumé/i }))
      await act(async () => {})

      expect(useScrapedJobsSync.getState().revision).toBe(0)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000)
      })

      expect(useScrapedJobsSync.getState().revision).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

})
