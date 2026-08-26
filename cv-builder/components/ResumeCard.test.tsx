// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ResumeCard from './ResumeCard'
import { Toaster } from '@/components/ui/Toaster'
import { useToastStore } from '@/lib/stores/toast.store'

const routerPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: routerPush }),
}))

const baseResume = {
  _id: 'abc123',
  title: 'My Resume',
  data: { basics: { label: 'Software Engineer' } },
  meta: { templateId: 'classic', layout: 'single-column', columnAssignment: {} },
  sectionsFilledCount: 3,
  formatScore: 20,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('ResumeCard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
    useToastStore.setState({ toasts: [] })
  })

  // Delete now lives behind a "More actions" overflow menu (Popover), separated
  // from Open/Duplicate/Track/Download to reduce accidental-click risk.
  function openOverflowMenu() {
    fireEvent.click(screen.getByLabelText(`More actions for "${baseResume.title}"`))
  }

  it('keeps Delete out of the directly-visible action row, collapsed inside an overflow menu', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    // Delete must not be rendered/clickable until the overflow menu is explicitly opened.
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
    // The other actions remain directly visible.
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByTitle('Duplicate')).toBeInTheDocument()
    expect(screen.getByTitle('Track application')).toBeInTheDocument()
    expect(screen.getByTitle('Download as JSON')).toBeInTheDocument()
    expect(screen.getByLabelText(`More actions for "${baseResume.title}"`)).toBeInTheDocument()
  })

  it('reveals Delete only after opening the overflow menu, and clicking it still starts the undo-delete flow', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    openOverflowMenu()
    const deleteBtn = screen.getByTitle('Delete')
    expect(deleteBtn).toBeInTheDocument()
    fireEvent.click(deleteBtn)
    expect(screen.queryByText(baseResume.title)).not.toBeInTheDocument()
    const t = useToastStore.getState().toasts[0]
    expect(t.message).toBe(`Deleted "${baseResume.title}"`)
    expect(t.actionLabel).toBe('Undo')
  })

  it('hides the card and shows an undo toast on delete', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    openOverflowMenu()
    fireEvent.click(screen.getByTitle('Delete'))
    expect(screen.queryByText(baseResume.title)).not.toBeInTheDocument()
    const t = useToastStore.getState().toasts[0]
    expect(t.message).toBe(`Deleted "${baseResume.title}"`)
    expect(t.actionLabel).toBe('Undo')
  })

  it('restores the card when undo is invoked, without calling DELETE', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    openOverflowMenu()
    fireEvent.click(screen.getByTitle('Delete'))
    act(() => { useToastStore.getState().toasts[0].onAction!() })
    expect(screen.getByText(baseResume.title)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fires DELETE after the undo window expires', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    openOverflowMenu()
    fireEvent.click(screen.getByTitle('Delete'))
    await act(async () => { vi.advanceTimersByTime(6100) })
    expect(fetchMock).toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, { method: 'DELETE' })
    vi.useRealTimers()
  })

  it('restores the card and shows an error toast when DELETE fails', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    openOverflowMenu()
    fireEvent.click(screen.getByTitle('Delete'))
    await act(async () => { vi.advanceTimersByTime(6100) })
    await act(async () => { await vi.runAllTimersAsync() })
    expect(screen.getByText(baseResume.title)).toBeInTheDocument()
    expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    vi.useRealTimers()
  })

  it('creates a linked application and navigates on "Track application"', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ application: { _id: 'app1' } }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)

    fireEvent.click(screen.getByTitle('Track application'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/applications',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ resumeId: baseResume._id }),
        })
      )
      expect(routerPush).toHaveBeenCalledWith('/dashboard/applications')
    })
  })

  it('shows an error toast and stays put when tracking fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)

    fireEvent.click(screen.getByTitle('Track application'))

    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
    })
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('displays format score badge with correct color for green (>=20)', () => {
    render(<ResumeCard resume={{ ...baseResume, formatScore: 22 }} applicationBadge={{ kind: 'none' }} />)
    const badge = screen.getByText('22/25')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('text-green-600')
  })

  it('displays format score badge with correct color for yellow (10-19)', () => {
    render(<ResumeCard resume={{ ...baseResume, formatScore: 15 }} applicationBadge={{ kind: 'none' }} />)
    const badge = screen.getByText('15/25')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('text-yellow-600')
  })

  it('displays format score badge with correct color for red (<10)', () => {
    render(<ResumeCard resume={{ ...baseResume, formatScore: 5 }} applicationBadge={{ kind: 'none' }} />)
    const badge = screen.getByText('5/25')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('text-red-500')
  })

  it('shows "Format Score" label (not "ATS Score")', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    expect(screen.getByText('Format Score')).toBeTruthy()
    expect(screen.queryByText('ATS Score')).toBeNull()
  })

  it('shows "Draft" when the badge kind is "none" (no linked applications)', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    expect(screen.getByText(/^draft$/i)).toBeInTheDocument()
  })

  it('shows the actual status label/color for a single linked application', () => {
    render(
      <ResumeCard
        resume={baseResume}
        applicationBadge={{ kind: 'single', label: 'Interviewing', color: '#f59e0b' }}
      />
    )
    const badge = screen.getByText(/^interviewing$/i)
    expect(badge).toBeInTheDocument()
    expect(badge.getAttribute('style')).toContain('background-color: rgb(245, 158, 11)') // #f59e0b
  })

  it('renders distinct, correctly colored badges for different single statuses', () => {
    const { unmount } = render(
      <ResumeCard resume={baseResume} applicationBadge={{ kind: 'single', label: 'Offer', color: '#22c55e' }} />
    )
    const offerBadge = screen.getByText(/^offer$/i)
    expect(offerBadge.getAttribute('style')).toContain('background-color: rgb(34, 197, 94)') // #22c55e
    unmount()

    render(
      <ResumeCard resume={baseResume} applicationBadge={{ kind: 'single', label: 'Rejected', color: '#ef4444' }} />
    )
    const rejectedBadge = screen.getByText(/^rejected$/i)
    expect(rejectedBadge.getAttribute('style')).toContain('background-color: rgb(239, 68, 68)') // #ef4444
    expect(rejectedBadge.getAttribute('style')).not.toBe(offerBadge.getAttribute('style'))
  })

  it('shows a count badge for multiple linked applications', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'multiple', count: 2 }} />)
    expect(screen.getByText('2 applications')).toBeInTheDocument()
  })

  it('falls back to "Unknown" label styling for a single badge with no matching status option', () => {
    render(
      <ResumeCard
        resume={baseResume}
        applicationBadge={{ kind: 'single', label: 'Unknown', color: '#94a3b8' }}
      />
    )
    expect(screen.getByText(/^unknown$/i)).toBeInTheDocument()
  })

  it('shows an error toast when duplicate fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    fireEvent.click(screen.getByTitle('Duplicate'))
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    })
  })

  it('shows an error toast when JSON download fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    fireEvent.click(screen.getByTitle('Download as JSON'))
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    })
  })

  it('has an aria-label on the Download button matching the Delete button convention', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    expect(screen.getByLabelText(`Download "${baseResume.title}" as JSON`)).toBeInTheDocument()
  })

  it('has an aria-label on the Duplicate button matching the Delete button convention', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    expect(screen.getByLabelText(`Duplicate "${baseResume.title}"`)).toBeInTheDocument()
  })

  it('pauses the undo-delete countdown while the toast is hovered, resuming with remaining time (not a full reset)', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(
      <>
        <ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />
        <Toaster />
      </>
    )
    openOverflowMenu()
    fireEvent.click(screen.getByTitle('Delete'))

    // Let 4s of the 6s undo window elapse (2s remaining).
    await act(async () => { vi.advanceTimersByTime(4000) })

    const toastEl = screen.getByText(`Deleted "${baseResume.title}"`).parentElement!
    fireEvent.mouseEnter(toastEl)

    // Advance well past the 2s that was remaining — should NOT fire while paused.
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, { method: 'DELETE' })

    fireEvent.mouseLeave(toastEl)

    // Resumes with ~2s remaining, not a fresh 6s window.
    await act(async () => { vi.advanceTimersByTime(2100) })
    expect(fetchMock).toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, { method: 'DELETE' })

    vi.useRealTimers()
  })

  it('routes to the CV editor when "Open" is clicked', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    const openLink = screen.getByText('Open')
    expect(openLink).toHaveAttribute('href', `/dashboard/resumes/${baseResume._id}`)
  })

  it('makes the action-button row wrap onto a second line on narrow viewports', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    const openSpan = screen.getByText('Open')
    const buttonRow = openSpan.parentElement!
    expect(buttonRow.className).toContain('flex-wrap')
  })

  it('disables the Download button and shows a loading indicator while a download is in flight', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })

    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)
    const btn = screen.getByTitle('Download as JSON')

    fireEvent.click(btn)
    expect(btn).toBeDisabled()
    expect(btn.textContent).toBe('…')

    // A second click while the first fetch is still in flight must not fire another fetch.
    fireEvent.click(btn)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ resume: { data: {} } }) })
    })

    expect(btn).not.toBeDisabled()
    expect(btn.textContent?.trim()).toBe('JSON')
  })

  it('pauses the undo-delete countdown while the toast has focus', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(
      <>
        <ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />
        <Toaster />
      </>
    )
    openOverflowMenu()
    fireEvent.click(screen.getByTitle('Delete'))

    await act(async () => { vi.advanceTimersByTime(4000) })

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss notification' })
    fireEvent.focus(dismissBtn)

    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, { method: 'DELETE' })

    fireEvent.blur(dismissBtn)

    await act(async () => { vi.advanceTimersByTime(2100) })
    expect(fetchMock).toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, { method: 'DELETE' })

    vi.useRealTimers()
  })

  it('shows a lineage indicator linking to the parent resume when one is set', () => {
    render(
      <ResumeCard
        resume={{ ...baseResume, parentResumeId: 'parent1', parentResumeTitle: 'Original Resume' }}
        applicationBadge={{ kind: 'none' }}
      />
    )

    const link = screen.getByRole('link', { name: /based on: original resume/i })
    expect(link).toHaveAttribute('href', '/dashboard/resumes/parent1')
  })

  it('omits the lineage indicator for a resume with no parent', () => {
    render(<ResumeCard resume={baseResume} applicationBadge={{ kind: 'none' }} />)

    expect(screen.queryByText(/based on:/i)).not.toBeInTheDocument()
  })
})
