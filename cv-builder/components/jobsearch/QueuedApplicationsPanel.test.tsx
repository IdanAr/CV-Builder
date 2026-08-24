// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueuedApplicationsPanel } from './QueuedApplicationsPanel'

const profile = { profile: { _id: 'p1', minAtsScore: 75 } }

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

beforeEach(() => {
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
})
