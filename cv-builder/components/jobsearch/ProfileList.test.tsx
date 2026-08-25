// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileList } from './ProfileList'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
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

  it('toggles isActive via PATCH when the active checkbox is clicked', async () => {
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
    await userEvent.click(screen.getByRole('checkbox', { name: /active/i }))

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
    await userEvent.click(screen.getByRole('checkbox', { name: /active/i }))

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

  it('deletes a profile via DELETE after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ profiles: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileList />)
    await screen.findByText('Frontend')
    await userEvent.click(screen.getByRole('button', { name: /delete frontend/i }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/jobsearch/profiles/p1', expect.objectContaining({ method: 'DELETE' }))
    )
    confirmSpy.mockRestore()
  })

  it('does not delete when the confirmation is dismissed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileList />)
    await screen.findByText('Frontend')
    await userEvent.click(screen.getByRole('button', { name: /delete frontend/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  it('shows an error message when DELETE fails', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ _id: 'p1', name: 'Frontend', isActive: true }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileList />)
    await screen.findByText('Frontend')
    await userEvent.click(screen.getByRole('button', { name: /delete frontend/i }))

    expect(await screen.findByText(/failed to delete profile/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
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
})
