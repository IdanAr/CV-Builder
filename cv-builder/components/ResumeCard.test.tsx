// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ResumeCard from './ResumeCard'
import { useToastStore } from '@/lib/stores/toast.store'

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

const baseResume = {
  _id: 'abc123',
  title: 'My Resume',
  data: { basics: { label: 'Software Engineer' } },
  meta: { templateId: 'classic', layout: 'single-column', columnAssignment: {} },
  sectionsFilledCount: 3,
  formatScore: 20,
  applicationStatus: 'draft' as const,
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

  it.each([
    ['draft', 'bg-gray-100'],
    ['applied', 'bg-blue-100'],
    ['interviewing', 'bg-amber-100'],
    ['offer', 'bg-green-100'],
    ['rejected', 'bg-red-100'],
  ])('renders the %s status select with the correct value and color class', (status, colorClass) => {
    render(<ResumeCard resume={{ ...baseResume, applicationStatus: status as typeof baseResume.applicationStatus }} />)
    const select = screen.getByLabelText(/application status/i) as HTMLSelectElement
    expect(select.value).toBe(status)
    expect(select.className).toContain(colorClass)
  })

  it('fires a PATCH with the new status and refreshes when the select changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(<ResumeCard resume={baseResume} />)
    const select = screen.getByLabelText(/application status/i)
    fireEvent.change(select, { target: { value: 'applied' } })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/resumes/${baseResume._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationStatus: 'applied' }),
      })
    })
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('reverts the select and shows an error toast when the status PATCH fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<ResumeCard resume={baseResume} />)
    const select = screen.getByLabelText(/application status/i) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'applied' } })
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    })
    await waitFor(() => expect(select.value).toBe('draft'))
  })

  it('shows target company and role when set', () => {
    render(<ResumeCard resume={{ ...baseResume, targetCompany: 'Acme Corp', targetRole: 'Senior Engineer' }} />)
    expect(screen.getByText('Acme Corp · Senior Engineer')).toBeInTheDocument()
  })

  it('omits the company/role row when neither is set', () => {
    render(<ResumeCard resume={baseResume} />)
    expect(screen.queryByTestId('target-company-role')).not.toBeInTheDocument()
  })

  it('shows the "Version of" tag when parentResumeTitle is present', () => {
    render(<ResumeCard resume={{ ...baseResume, parentResumeTitle: 'Original Resume' }} />)
    expect(screen.getByText(/Version of "Original Resume"/)).toBeInTheDocument()
  })

  it('omits the "Version of" tag when parentResumeTitle is absent', () => {
    render(<ResumeCard resume={baseResume} />)
    expect(screen.queryByText(/Version of/)).not.toBeInTheDocument()
  })
})
