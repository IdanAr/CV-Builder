// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobMatchesFeed } from './JobMatchesFeed'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('JobMatchesFeed', () => {
  it('lists notify-rule matches fetched on mount', async () => {
    const mockFetch = vi.fn((url: string) => {
      if (url === '/api/jobsearch/notifications') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            matches: [{ _id: 'm1', profileId: 'p1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/a1', status: 'new' }],
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<JobMatchesFeed />)

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
  })

  it('marks unread matches as read after loading the feed', async () => {
    const mockFetch = vi.fn((url: string) => {
      if (url === '/api/jobsearch/notifications') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ matches: [{ _id: 'm1', profileId: 'p1', title: 'X', company: 'Y', url: '', status: 'new' }] }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<JobMatchesFeed />)
    await screen.findByText('X')

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/notifications/mark-read',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })

  it('shows an empty state when there are no matches', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ matches: [] }) } as Response)

    render(<JobMatchesFeed />)

    expect(await screen.findByText(/no job matches yet/i)).toBeInTheDocument()
  })

  it('dismisses a match and removes it from the list', async () => {
    const mockFetch = vi.fn((url: string, opts?: { method?: string }) => {
      if (url === '/api/jobsearch/notifications') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ matches: [{ _id: 'm1', profileId: 'p1', title: 'Backend Engineer', company: 'Acme', url: '', status: 'new' }] }),
        })
      }
      if (url === '/api/jobsearch/scraped-jobs/m1' && opts?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<JobMatchesFeed />)
    await screen.findByText('Backend Engineer')
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument())
  })

  it('shows a full error view with a retry button when the initial load fails', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ matches: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<JobMatchesFeed />)

    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText(/no job matches yet/i)).toBeInTheDocument()
  })
})
