// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ResumeCard from './ResumeCard'
import { Toaster } from '@/components/ui/Toaster'
import { useToastStore } from '@/lib/stores/toast.store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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

  it('hides the card and shows an undo toast on delete', () => {
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    expect(screen.queryByText(baseResume.title)).not.toBeInTheDocument()
    const t = useToastStore.getState().toasts[0]
    expect(t.message).toBe(`Deleted "${baseResume.title}"`)
    expect(t.actionLabel).toBe('Undo')
  })

  it('restores the card when undo is invoked, without calling DELETE', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    act(() => { useToastStore.getState().toasts[0].onAction!() })
    expect(screen.getByText(baseResume.title)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fires DELETE after the undo window expires', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    await act(async () => { vi.advanceTimersByTime(6100) })
    expect(fetchMock).toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, { method: 'DELETE' })
    vi.useRealTimers()
  })

  it('restores the card and shows an error toast when DELETE fails', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    await act(async () => { vi.advanceTimersByTime(6100) })
    await act(async () => { await vi.runAllTimersAsync() })
    expect(screen.getByText(baseResume.title)).toBeInTheDocument()
    expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    vi.useRealTimers()
  })

  it('displays format score badge with correct color for green (>=20)', () => {
    render(<ResumeCard resume={{ ...baseResume, formatScore: 22 }} />)
    const badge = screen.getByText('22/25')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('text-green-600')
  })

  it('displays format score badge with correct color for yellow (10-19)', () => {
    render(<ResumeCard resume={{ ...baseResume, formatScore: 15 }} />)
    const badge = screen.getByText('15/25')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('text-yellow-600')
  })

  it('displays format score badge with correct color for red (<10)', () => {
    render(<ResumeCard resume={{ ...baseResume, formatScore: 5 }} />)
    const badge = screen.getByText('5/25')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('text-red-500')
  })

  it('shows "Format Score" label (not "ATS Score")', () => {
    render(<ResumeCard resume={baseResume} />)
    expect(screen.getByText('Format Score')).toBeTruthy()
    expect(screen.queryByText('ATS Score')).toBeNull()
  })

  it('shows an error toast when duplicate fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Duplicate'))
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    })
  })

  it('shows an error toast when JSON download fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Download as JSON'))
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    })
  })

  it('has an aria-label on the Download button matching the Delete button convention', () => {
    render(<ResumeCard resume={baseResume} />)
    expect(screen.getByLabelText(`Download "${baseResume.title}" as JSON`)).toBeInTheDocument()
  })

  it('has an aria-label on the Duplicate button matching the Delete button convention', () => {
    render(<ResumeCard resume={baseResume} />)
    expect(screen.getByLabelText(`Duplicate "${baseResume.title}"`)).toBeInTheDocument()
  })

  it('pauses the undo-delete countdown while the toast is hovered, resuming with remaining time (not a full reset)', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(
      <>
        <ResumeCard resume={baseResume} />
        <Toaster />
      </>
    )
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

  it('pauses the undo-delete countdown while the toast has focus', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(
      <>
        <ResumeCard resume={baseResume} />
        <Toaster />
      </>
    )
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
})
