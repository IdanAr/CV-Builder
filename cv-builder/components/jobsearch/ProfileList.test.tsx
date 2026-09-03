// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileList } from './ProfileList'
import { useToastStore } from '@/lib/stores/toast.store'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  useToastStore.setState({ toasts: [] })
})

describe('ProfileList', () => {
  it('lists existing profiles fetched on mount', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        profiles: [
          { _id: 'p1', name: 'Frontend, Remote EU', isActive: true },
          { _id: 'p2', name: 'Data Science, Israel', isActive: false },
        ],
      }),
    } as Response)

    render(<ProfileList />)

    expect(await screen.findByText('Frontend, Remote EU')).toBeInTheDocument()
    expect(screen.getByText('Data Science, Israel')).toBeInTheDocument()
  })

  it('shows an empty state with a "Create profile" affordance when there are none', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ profiles: [] }) } as Response)

    render(<ProfileList />)

    expect(await screen.findByRole('button', { name: /create.*profile/i })).toBeInTheDocument()
  })

  it('toggles isActive via PATCH when the active switch is flipped', async () => {
    const mockFetch = vi.fn()
    // First mock: initial GET on mount
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    // Second mock: PATCH response
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ profile: { _id: 'p1', isActive: false } }) })
    // Third mock: reload GET after PATCH succeeds (correction from pre-flight review)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: false }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileList />)
    await screen.findByText('Frontend')
    await userEvent.click(screen.getByRole('switch', { name: /active/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/profiles/p1',
        expect.objectContaining({ method: 'PATCH' })
      )
    )
  })

  it('shows an error message when the initial GET fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    render(<ProfileList />)

    expect(await screen.findByText(/an error occurred/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('shows an error message when PATCH fails and does not reload', async () => {
    const mockFetch = vi.fn()
    // First mock: initial GET on mount succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    // Second mock: PATCH fails
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileList />)
    await screen.findByText('Frontend')
    await userEvent.click(screen.getByRole('switch', { name: /active/i }))

    // Should show error message
    expect(await screen.findByText(/failed to update profile/i)).toBeInTheDocument()

    // Should only have 2 calls (initial GET and PATCH), not 3 (no reload GET)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // The already-loaded list must stay visible underneath the error banner —
    // a failed PATCH must not blank out previously-fetched data.
    expect(screen.getByText('Frontend')).toBeInTheDocument()
  })

  it('shows a "Try again" full-screen error only when the very first load fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    render(<ProfileList />)

    expect(await screen.findByText(/an error occurred/i)).toBeInTheDocument()
    // No list content and no "Create profile" affordance should render behind
    // the full-screen error, because nothing has loaded yet.
    expect(screen.queryByRole('button', { name: /create.*profile/i })).not.toBeInTheDocument()
  })

  async function openDeleteMenu() {
    await userEvent.click(screen.getByRole('button', { name: /more actions for frontend/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /delete profile/i }))
  }

  it('removes the row immediately and offers an undo instead of a confirm dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileList />)
    await screen.findByText('Frontend')
    await openDeleteMenu()

    await waitFor(() => expect(screen.queryByText('Frontend')).not.toBeInTheDocument())
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({ actionLabel: 'Undo' })
    // The DELETE is deliberately still pending — only the initial GET has run.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  it('commits the pending DELETE when the list unmounts before the undo window closes', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<ProfileList />)
    await screen.findByText('Frontend')
    await openDeleteMenu()
    await waitFor(() => expect(screen.queryByText('Frontend')).not.toBeInTheDocument())

    unmount()

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobsearch/profiles/p1',
        expect.objectContaining({ method: 'DELETE' })
      )
    )
  })

  it('cancels the deletion when the undo action is taken', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { unmount } = render(<ProfileList />)
    await screen.findByText('Frontend')
    await openDeleteMenu()
    await waitFor(() => expect(screen.queryByText('Frontend')).not.toBeInTheDocument())

    const undo = useToastStore.getState().toasts.at(-1)?.onAction
    expect(undo).toBeTypeOf('function')
    undo!()

    // The row comes back from a reload, and unmounting no longer commits
    // anything — the pending timer was cleared.
    expect(await screen.findByText('Frontend')).toBeInTheDocument()
    unmount()
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/jobsearch/profiles/p1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('links each profile to its scraped-jobs page', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend, Remote EU', isActive: true }] }),
    } as Response)

    render(<ProfileList />)

    const link = await screen.findByRole('link', { name: 'Frontend, Remote EU' })
    expect(link).toHaveAttribute('href', '/dashboard/jobsearch/p1')
  })

  it('summarises what a profile watches as chips', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        profiles: [
          {
            _id: 'p1',
            name: 'Frontend',
            isActive: true,
            roles: ['React'],
            workModes: ['remote', 'hybrid'],
            locations: [{ city: 'Tel Aviv', country: 'Israel' }],
            comeetCompanies: [{ name: 'Acme' }, { name: 'Globex' }],
            minAtsScore: 78,
            recencyDays: 14,
          },
        ],
      }),
    } as Response)

    render(<ProfileList />)

    expect(await screen.findByText('React')).toBeInTheDocument()
    expect(screen.getByText('remote · hybrid')).toBeInTheDocument()
    expect(screen.getByText('Tel Aviv, Israel')).toBeInTheDocument()
    expect(screen.getByText('2 companies')).toBeInTheDocument()
    expect(screen.getByText('≥ 78% fit')).toBeInTheDocument()
    expect(screen.getByText('last 14 days')).toBeInTheDocument()
  })

  it('skips the mount fetch when the server already supplied the profiles', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ProfileList initialProfiles={[{ _id: 'p1', name: 'Seeded', isActive: true }]} />
    )

    expect(await screen.findByText('Seeded')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('hides the metric cluster on a paused profile', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        profiles: [
          { _id: 'p1', name: 'Frontend', isActive: false, newMatchCount: 4, queuedCount: 2 },
        ],
      }),
    } as Response)

    render(<ProfileList />)

    expect(await screen.findByText('Paused')).toBeInTheDocument()
    expect(screen.queryByText('new')).not.toBeInTheDocument()
    expect(screen.queryByText('queued')).not.toBeInTheDocument()
  })
})
