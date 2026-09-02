// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScrapedJobsList } from './ScrapedJobsList'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
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
    expect(screen.getByText(/82/)).toBeInTheDocument()
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

  it('dismisses a listing and reloads the list', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: 'https://x/a1', status: 'new' }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: 'https://x/a1', status: 'dismissed' }] }),
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
    expect(await screen.findByText('Non-Active')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^restore$/i })).toBeInTheDocument()
  })

  it('restores a dismissed listing', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: 'https://x/a1', status: 'dismissed' }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: 'https://x/a1', status: 'new' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByRole('button', { name: /^restore$/i })
    await userEvent.click(screen.getByRole('button', { name: /^restore$/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/scraped-jobs/j1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ dismissed: false }) })
      )
    )
    expect(await screen.findByRole('button', { name: /^dismiss$/i })).toBeInTheDocument()
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

  it('deletes a listing after confirmation and reloads the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: 'https://x/a1', status: 'new' }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ scrapedJobs: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Job A')
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1', expect.objectContaining({ method: 'DELETE' }))
    )
    expect(await screen.findByText(/no scraped jobs yet/i)).toBeInTheDocument()
  })

  it('does not delete when the user cancels the confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ scrapedJobs: [{ _id: 'j1', title: 'Job A', company: 'Acme', url: 'https://x/a1', status: 'new' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ScrapedJobsList profileId="p1" />)
    await screen.findByText('Job A')
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(mockFetch).not.toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1', expect.objectContaining({ method: 'DELETE' }))
    expect(screen.getByText('Job A')).toBeInTheDocument()
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
})
