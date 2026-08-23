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
})
