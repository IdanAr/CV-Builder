// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScrapedJobsList } from './ScrapedJobsList'
import { useScrapedJobsSync, notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'
import { useToastStore } from '@/lib/stores/toast.store'

beforeEach(() => {
  useScrapedJobsSync.setState({ revision: 0 })
  vi.stubGlobal('fetch', vi.fn())
  useToastStore.setState({ toasts: [] })
})

describe('ScrapedJobsList', () => {
  it('lists scraped jobs fetched on mount', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [
          { _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/a1', atsScore: 82, status: 'new' },
        ],
      }),
    } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('82% match')).toBeInTheDocument()
  })

  it('shows an empty state with a Scan now button when there are no jobs yet', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ scrapedJobs: [] }) } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    expect(await screen.findByRole('button', { name: /scan now/i })).toBeInTheDocument()
    expect(screen.getByText(/no scraped jobs yet/i)).toBeInTheDocument()
  })

  it('triggers a scan and reloads the list on click', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ scrapedJobs: [] }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { fetched: 1, created: 1, skippedExisting: 0, degraded: false } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scrapedJobs: [{ _id: 'j1', title: 'New Job', company: 'Acme', url: 'https://x/a1', status: 'new' }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByRole('button', { name: /scan now/i })
    await userEvent.click(screen.getByRole('button', { name: /scan now/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/scan',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ profileId: 'p1' }) })
      )
    )
    expect(await screen.findByText('New Job')).toBeInTheDocument()
  })

  it('renders the title as plain text (not a link) when url is empty', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [
          { _id: 'j1', title: 'Suspicious Job', company: 'Acme', url: '', status: 'new' },
        ],
      }),
    } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    expect(await screen.findByText('Suspicious Job')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Suspicious Job' })).not.toBeInTheDocument()
  })

  it('shows a full error view with a retry button when the initial load fails, not a blank page', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scrapedJobs: [{ _id: 'j1', title: 'Recovered Job', company: 'Acme', url: 'https://x/a1', status: 'new' }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)

    expect(await screen.findByText(/failed to load scraped jobs/i)).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: /try again/i })
    expect(retryButton).toBeInTheDocument()
    // Nothing else should render behind the full-screen error — nothing has
    // loaded yet, so no "Scan now" button and no list.
    expect(screen.queryByRole('button', { name: /scan now/i })).not.toBeInTheDocument()

    await userEvent.click(retryButton)

    expect(await screen.findByText('Recovered Job')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('shows the posting\'s original publish date when available', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [
          {
            _id: 'j1',
            title: 'Backend Engineer',
            company: 'Acme',
            url: 'https://x/a1',
            status: 'new',
            postedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
    } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    expect(await screen.findByText(/posted/i)).toHaveTextContent('Posted Aug 1, 2026')
  })

  it('omits the posted-date line when postedAt is unknown', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [{ _id: 'j1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/a1', status: 'new' }],
      }),
    } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    await screen.findByText('Backend Engineer')
    expect(screen.queryByText(/posted/i)).not.toBeInTheDocument()
  })

  it('shows an error banner without clearing the list when a scan fails', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Existing Job', company: 'Acme', url: 'https://x/a1', status: 'new' }] }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { fetched: 0, created: 0, skippedExisting: 0, degraded: true, errorMessage: 'freehire returned 503' } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Existing Job', company: 'Acme', url: 'https://x/a1', status: 'new' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Existing Job')
    await userEvent.click(screen.getByRole('button', { name: /scan now/i }))

    expect(await screen.findByText(/freehire returned 503/i)).toBeInTheDocument()
    expect(screen.getByText('Existing Job')).toBeInTheDocument()
  })

  it('dismisses a listing, moving it out of the default Active filter with an undo', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'new' }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'dismissed' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Job A')
    await userEvent.click(screen.getByRole('button', { name: /^dismiss$/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/scraped-jobs/j1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ dismissed: true }) })
      )
    )

    // It leaves the Active view rather than sitting there greyed out, so the
    // toast is what tells you it happened.
    await waitFor(() => expect(screen.queryByText('Job A')).not.toBeInTheDocument())
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({ actionLabel: 'Undo' })
  })

  it('shows dismissed listings, badged and restorable, under the Dismissed filter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'dismissed' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /^dismissed/i }))

    expect(await screen.findByText('Job A')).toBeInTheDocument()
    expect(screen.getByText('Non-Active')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument()
  })

  it('restores a dismissed listing', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'dismissed' }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'new' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /^dismissed/i }))
    await userEvent.click(await screen.findByRole('button', { name: /^restore$/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/scraped-jobs/j1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ dismissed: false }) })
      )
    )
    // Restoring is not itself undoable — nothing was lost.
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('hides the dismiss/restore control for a submitted listing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: 'https://x/a1', status: 'submitted' }],
      }),
    } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    await screen.findByText('Job A')
    expect(screen.queryByRole('button', { name: /^dismiss$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^restore$/i })).not.toBeInTheDocument()
  })

  it('removes a listing immediately and offers an undo instead of a confirm dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'new' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Job A')
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(screen.queryByText('Job A')).not.toBeInTheDocument())
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({ actionLabel: 'Undo' })
    // Still only the initial GET — the DELETE waits out the undo window.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  it('names the tailored résumé in the delete toast, because the DELETE takes it too', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [
          { _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'queued', draftResumeId: 'r1' },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Job A')
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
        message: 'Deleted "Job A" and its tailored résumé',
      })
    )
  })

  it('commits the pending DELETE when the list unmounts before the undo window closes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'new' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Job A')
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.queryByText('Job A')).not.toBeInTheDocument())

    unmount()

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/scraped-jobs/j1',
        expect.objectContaining({ method: 'DELETE' })
      )
    )
  })

  it('cancels the deletion when the undo action is taken', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'new' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Job A')
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.queryByText('Job A')).not.toBeInTheDocument())

    useToastStore.getState().toasts.at(-1)!.onAction!()

    expect(await screen.findByText('Job A')).toBeInTheDocument()
    unmount()
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/jobsearch/scraped-jobs/j1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('aborts the mount-time fetch on unmount', async () => {
    let capturedSignal: AbortSignal | undefined
    const mockFetch = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).startsWith('/api/jobsearch/scraped-jobs?')) {
        capturedSignal = init?.signal as AbortSignal | undefined
        return new Promise<Response>(() => {}) // never resolves
      }
      return Promise.resolve({ ok: true, json: async () => ({ scrapedJobs: [] }) } as Response)
    })
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<ScrapedJobsList profileId="p1" />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal!.aborted).toBe(false)

    unmount()

    expect(capturedSignal!.aborted).toBe(true)
  })

  it('does not show an error banner when profileId changes while a fetch is in flight', async () => {
    const mockFetch = vi.fn((url: string) => {
      if (String(url).includes('profileId=p1')) {
        return new Promise<Response>(() => {}) // never resolves — simulates the stale in-flight request
      }
      return Promise.resolve({ ok: true, json: async () => ({ scrapedJobs: [] }) } as Response)
    })
    vi.stubGlobal('fetch', mockFetch)

    const { rerender } = render(<ScrapedJobsList profileId="p1" />)
    rerender(<ScrapedJobsList profileId="p2" />)

    await screen.findByRole('button', { name: /scan now/i })
    expect(screen.queryByText(/failed to load scraped jobs/i)).not.toBeInTheDocument()
  })

  it('requests tombstones too, so the Deleted filter can count them', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ scrapedJobs: [] }) } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/jobsearch/scraped-jobs?profileId=p1&includeDeleted=1',
        expect.anything()
      )
    )
  })

  it('keeps deleted postings out of the live filters and behind a Deleted tab', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [
          { _id: 'j1', title: 'Live Job', company: 'Acme', url: 'https://x/a1', status: 'new' },
          {
            _id: 'j2',
            title: 'Dead Job',
            company: 'Acme',
            url: 'https://x/a2',
            status: 'queued',
            deletedAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      }),
    } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    expect(await screen.findByText('Live Job')).toBeInTheDocument()
    expect(screen.queryByText('Dead Job')).not.toBeInTheDocument()

    // "All" must mean all live postings, not all rows - a tombstone is a dedup
    // record, not something the user still has here.
    await userEvent.click(screen.getByRole('button', { name: /^all/i }))
    expect(screen.getByText('Live Job')).toBeInTheDocument()
    expect(screen.queryByText('Dead Job')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^deleted/i }))

    expect(await screen.findByText('Dead Job')).toBeInTheDocument()
    expect(screen.queryByText('Live Job')).not.toBeInTheDocument()
  })

  it('offers no Deleted tab when nothing has been deleted', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        scrapedJobs: [{ _id: 'j1', title: 'Live Job', company: 'Acme', url: 'https://x/a1', status: 'new' }],
      }),
    } as Response)

    render(<ScrapedJobsList profileId="p1" />)

    await screen.findByText('Live Job')
    expect(screen.queryByRole('button', { name: /^Deleted/i })).not.toBeInTheDocument()
  })

  it('drops the tombstone via Find again so the next scan can pick the posting up', async () => {
    const mockFetch = vi.fn()
    const withTombstone = {
      ok: true,
      json: async () => ({
        scrapedJobs: [
          {
            _id: 'j2',
            title: 'Dead Job',
            company: 'Acme',
            url: 'https://x/a2',
            status: 'queued',
            deletedAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      }),
    }
    mockFetch.mockResolvedValueOnce(withTombstone)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ scrapedJobs: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /^deleted/i }))
    await userEvent.click(await screen.findByRole('button', { name: /find again/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/scraped-jobs/j2',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ deleted: false }) })
      )
    )
  })


  // The queued panel is a sibling component with no state in common with this
  // list. Deleting there leaves a tombstone this list has never fetched, so
  // without the shared signal the Deleted tab only showed up after a refresh.
  it('reloads when a sibling reports a change, so a delete elsewhere shows up without a refresh', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scrapedJobs: [{ _id: 'j1', title: 'Live Job', company: 'Acme', url: 'https://x/a1', status: 'new' }],
      }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scrapedJobs: [
          { _id: 'j1', title: 'Live Job', company: 'Acme', url: 'https://x/a1', status: 'new' },
          {
            _id: 'j2',
            title: 'Dead Job',
            company: 'Acme',
            url: 'https://x/a2',
            status: 'queued',
            deletedAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Live Job')
    expect(screen.queryByRole('button', { name: /^deleted/i })).not.toBeInTheDocument()

    act(() => notifyScrapedJobsChanged())

    expect(await screen.findByRole('button', { name: /^deleted/i })).toBeInTheDocument()
  })

  it('does not re-fetch on mount just because an earlier mutation left the counter set', async () => {
    useScrapedJobsSync.setState({ revision: 7 })
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ scrapedJobs: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)

    await screen.findByRole('button', { name: /scan now/i })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('announces the change once its own delete commits, so the Deleted tab appears', async () => {
    vi.useFakeTimers()
    try {
      // fireEvent rather than userEvent: userEvent's own timer coordination
      // deadlocks against vi's fake clock, and this only needs a plain click.
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: '', status: 'new' }] }),
      })
      vi.stubGlobal('fetch', mockFetch)

      render(<ScrapedJobsList profileId="p1" />)
      await act(async () => {})

      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

      // Nothing sent yet - the undo window is still open.
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
