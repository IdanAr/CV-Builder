// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobMatchesFeed } from './JobMatchesFeed'
import { useToastStore } from '@/lib/stores/toast.store'

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  routerPush.mockClear()
  useToastStore.setState({ toasts: [] })
})

/** The feed's own GET, with everything else answered generically. */
function feedReturning(matches: unknown[]) {
  return vi.fn((url: string) => {
    if (url === '/api/jobsearch/notifications') {
      return Promise.resolve({ ok: true, json: async () => ({ matches }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
  })
}

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

    expect(await screen.findByText(/nothing has matched yet/i)).toBeInTheDocument()
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

    expect(await screen.findByText(/nothing has matched yet/i)).toBeInTheDocument()
  })

  it('aborts the mount-time fetch on unmount', async () => {
    let capturedSignal: AbortSignal | undefined
    const mockFetch = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/jobsearch/notifications') {
        capturedSignal = init?.signal as AbortSignal | undefined
        return new Promise<Response>(() => {}) // never resolves
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response)
    })
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<JobMatchesFeed />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal!.aborted).toBe(false)

    unmount()

    expect(capturedSignal!.aborted).toBe(true)
  })

  it('leads the card with the fit score', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', title: 'Senior Frontend', company: 'Acme', url: '', status: 'new', atsScore: 91 },
      ])
    )

    render(<JobMatchesFeed />)

    expect(await screen.findByText('91')).toBeInTheDocument()
    expect(screen.getByText('91% match')).toBeInTheDocument()
  })

  it('keeps matches marked unread for the visit that read them', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', title: 'Fresh', company: 'Acme', url: '', status: 'new', atsScore: 90 },
        { _id: 'm2', profileId: 'p1', title: 'Seen', company: 'Globex', url: '', status: 'notified', atsScore: 90 },
      ])
    )

    render(<JobMatchesFeed />)
    await screen.findByText('Fresh')

    // The mark-read POST has already fired; the snapshot is what keeps the
    // badge's promise, so filtering to Unread must still find the new one.
    await userEvent.click(screen.getByRole('button', { name: /unread/i }))

    expect(screen.getByText('Fresh')).toBeInTheDocument()
    expect(screen.queryByText('Seen')).not.toBeInTheDocument()
  })

  it('filters to strong fits', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', title: 'Great', company: 'Acme', url: '', status: 'new', atsScore: 91 },
        { _id: 'm2', profileId: 'p1', title: 'Fair', company: 'Globex', url: '', status: 'new', atsScore: 72 },
      ])
    )

    render(<JobMatchesFeed />)
    await screen.findByText('Great')

    await userEvent.click(screen.getByRole('button', { name: /strong fit/i }))

    expect(screen.getByText('Great')).toBeInTheDocument()
    expect(screen.queryByText('Fair')).not.toBeInTheDocument()
  })

  it('tracks a match as an application without a new endpoint', async () => {
    const mockFetch = feedReturning([
      { _id: 'm1', profileId: 'p1', title: 'Senior Frontend', company: 'Acme', url: '', status: 'new', atsScore: 91 },
    ])
    vi.stubGlobal('fetch', mockFetch)

    render(<JobMatchesFeed />)
    await screen.findByText('Senior Frontend')
    await userEvent.click(screen.getByRole('button', { name: /track this application/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/applications',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ company: 'Acme', role: 'Senior Frontend' }),
        })
      )
    )
    expect(routerPush).toHaveBeenCalledWith('/dashboard/applications')
  })

  it('withholds the primary action on a weak match rather than disabling it', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', title: 'Weak', company: 'Acme', url: '', status: 'new', atsScore: 64 },
      ])
    )

    render(<JobMatchesFeed />)
    await screen.findByText('Weak')

    expect(screen.queryByRole('button', { name: /track this application/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('attributes a match to the rule and profile that found it', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        {
          _id: 'm1',
          profileId: 'p1',
          profileName: 'Remote React roles',
          matchedRules: ['High-fit React roles'],
          title: 'Senior Frontend',
          company: 'Acme',
          url: '',
          status: 'new',
          atsScore: 91,
        },
      ])
    )

    render(<JobMatchesFeed />)

    expect(await screen.findByText(/High-fit React roles/)).toBeInTheDocument()
    expect(screen.getByText('Remote React roles')).toBeInTheDocument()
  })

  it('groups the feed by day while it is in date order', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        {
          _id: 'm1',
          profileId: 'p1',
          title: 'Today job',
          company: 'Acme',
          url: '',
          status: 'new',
          atsScore: 91,
          createdAt: new Date().toISOString(),
        },
        {
          _id: 'm2',
          profileId: 'p1',
          title: 'Old job',
          company: 'Globex',
          url: '',
          status: 'new',
          atsScore: 88,
          createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        },
      ])
    )

    render(<JobMatchesFeed />)

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Earlier' })).toBeInTheDocument()
  })

  it('offers an undo after dismissing', async () => {
    const mockFetch = feedReturning([
      { _id: 'm1', profileId: 'p1', title: 'Backend Engineer', company: 'Acme', url: '', status: 'new', atsScore: 80 },
    ])
    vi.stubGlobal('fetch', mockFetch)

    render(<JobMatchesFeed />)
    await screen.findByText('Backend Engineer')
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument())
    const undo = useToastStore.getState().toasts.at(-1)
    expect(undo).toMatchObject({ actionLabel: 'Undo' })
  })

  it('shows only the given profile\'s matches when scoped', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', title: 'Mine', company: 'Acme', url: '', status: 'new', atsScore: 90 },
        { _id: 'm2', profileId: 'p2', title: 'Other profile', company: 'Globex', url: '', status: 'new', atsScore: 90 },
      ])
    )

    render(<JobMatchesFeed profileId="p1" />)

    expect(await screen.findByText('Mine')).toBeInTheDocument()
    expect(screen.queryByText('Other profile')).not.toBeInTheDocument()
  })

  it('marks only the scoped profile read, leaving other profiles\' unread counts alone', async () => {
    const mockFetch = feedReturning([
      { _id: 'm1', profileId: 'p1', title: 'Mine', company: 'Acme', url: '', status: 'new', atsScore: 90 },
    ])
    vi.stubGlobal('fetch', mockFetch)

    render(<JobMatchesFeed profileId="p1" />)
    await screen.findByText('Mine')

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/notifications/mark-read',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ profileId: 'p1' }) })
      )
    )
  })

  it('offers no profile filter when it is already scoped to one', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', profileName: 'A', title: 'Mine', company: 'Acme', url: '', status: 'new', atsScore: 90 },
      ])
    )

    render(<JobMatchesFeed profileId="p1" />)
    await screen.findByText('Mine')

    expect(screen.queryByLabelText(/^profile$/i)).not.toBeInTheDocument()
  })

  it('filters the cross-profile feed down to one profile', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', profileName: 'Frontend', title: 'From A', company: 'Acme', url: '', status: 'new', atsScore: 90 },
        { _id: 'm2', profileId: 'p2', profileName: 'Backend', title: 'From B', company: 'Globex', url: '', status: 'new', atsScore: 90 },
      ])
    )

    render(<JobMatchesFeed />)
    await screen.findByText('From A')

    await userEvent.selectOptions(screen.getByLabelText(/^profile$/i), 'p2')

    expect(screen.getByText('From B')).toBeInTheDocument()
    expect(screen.queryByText('From A')).not.toBeInTheDocument()
  })

  it('hides the profile filter when every match came from the same profile', async () => {
    vi.stubGlobal(
      'fetch',
      feedReturning([
        { _id: 'm1', profileId: 'p1', profileName: 'Frontend', title: 'One', company: 'Acme', url: '', status: 'new', atsScore: 90 },
        { _id: 'm2', profileId: 'p1', profileName: 'Frontend', title: 'Two', company: 'Globex', url: '', status: 'new', atsScore: 90 },
      ])
    )

    render(<JobMatchesFeed />)
    await screen.findByText('One')

    expect(screen.queryByLabelText(/^profile$/i)).not.toBeInTheDocument()
  })
})
