// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ResumeCard from './ResumeCard'
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

  it('shows delete button in normal state (no confirmation UI)', () => {
    render(<ResumeCard resume={baseResume} />)
    // The delete button (✕) should be visible
    expect(screen.getByTitle('Delete')).toBeTruthy()
    // Confirmation UI should not be visible
    expect(screen.queryByText('Sure?')).toBeNull()
    expect(screen.queryByText('Yes, delete')).toBeNull()
    expect(screen.queryByText('Cancel')).toBeNull()
  })

  it('clicking delete shows inline confirmation', () => {
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    expect(screen.getByText('Sure?')).toBeTruthy()
    expect(screen.getByText('Yes, delete')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
    // Original delete button (✕) should be gone
    expect(screen.queryByTitle('Delete')).toBeNull()
  })

  it('clicking Cancel hides the confirmation', () => {
    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    expect(screen.getByText('Sure?')).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Sure?')).toBeNull()
    expect(screen.queryByText('Yes, delete')).toBeNull()
    expect(screen.queryByText('Cancel')).toBeNull()
    expect(screen.getByTitle('Delete')).toBeTruthy()
  })

  it('clicking "Yes, delete" calls the delete API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = mockFetch

    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    fireEvent.click(screen.getByText('Yes, delete'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/resumes/${baseResume._id}`,
        { method: 'DELETE' }
      )
    })
  })

  it('does not call fetch when first clicking the delete button', () => {
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    render(<ResumeCard resume={baseResume} />)
    fireEvent.click(screen.getByTitle('Delete'))
    expect(mockFetch).not.toHaveBeenCalled()
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
})
