// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobDetail } from './JobDetail'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'

const mk = (over: Partial<PipelineJob> = {}): PipelineJob => ({
  _id: 'a', profileId: 'p', profileName: 'Frontend', title: 'Staff Engineer', company: 'Acme',
  location: 'Remote', url: 'https://example.com/job', matchedRules: ['Remote React'],
  pendingApprovals: [], tailoredKeywords: [], status: 'new', stage: 'found',
  createdAt: new Date().toISOString(), ...over,
})

function setup(job: PipelineJob | null, busy = false) {
  const onAction = vi.fn()
  const onBack = vi.fn()
  render(<JobDetail job={job} busy={busy} onAction={onAction} onBack={onBack} />)
  return { onAction, onBack }
}

describe('JobDetail', () => {
  it('shows a quiet empty state without a job', () => {
    setup(null)
    expect(screen.getByText('Select a job to see its details.')).toBeTruthy()
  })

  it('renders title, meta, rules, posting link and fit', () => {
    setup(mk({ atsScore: 82, postTailorScore: 90, draftResumeId: 'r1' }))
    expect(screen.getByRole('region', { name: 'Job details' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Staff Engineer' })).toBeTruthy()
    expect(screen.getByText('Acme · Remote · Frontend')).toBeTruthy()
    expect(screen.getByText('Remote React')).toBeTruthy()
    expect(screen.getByText(/after tailoring 90/i)).toBeTruthy()
    const posting = screen.getAllByRole('link', { name: /Open posting/ })[0]
    expect(posting.getAttribute('target')).toBe('_blank')
    expect(posting.getAttribute('rel')).toBe('noreferrer')
    expect(screen.getByRole('link', { name: 'Tailored CV' }).getAttribute('href')).toBe('/dashboard/resumes/r1')
  })

  it('explains when no rule matched', () => {
    setup(mk({ matchedRules: [] }))
    expect(screen.getByText('No rule matched this posting directly.')).toBeTruthy()
  })

  it('shows the flagged claims block only with approvals', () => {
    const { unmount } = render(
      <JobDetail job={mk({ stage: 'drafted', pendingApprovals: ['10x revenue'] })} busy={false} onAction={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.getByText('Flagged claims need your approval')).toBeTruthy()
    expect(screen.getByText('10x revenue')).toBeTruthy()
    unmount()
    setup(mk({ stage: 'drafted' }))
    expect(screen.queryByText('Flagged claims need your approval')).toBeNull()
  })

  it('renders the action label set per stage and calls onAction', () => {
    const { onAction } = setup(mk({ stage: 'ready', draftResumeId: 'r1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark as applied' }))
    expect(onAction).toHaveBeenCalledWith('mark-applied', expect.objectContaining({ _id: 'a' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onAction).toHaveBeenCalledWith('dismiss', expect.anything())
    expect(screen.getByRole('link', { name: 'Open tailored CV' }).getAttribute('href')).toBe('/dashboard/resumes/r1')
  })

  it('renders a drafted job with no primary action', () => {
    setup(mk({ stage: 'drafted' }))
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve flagged claims' })).toBeNull()
  })

  it('has an overflow menu with Delete for non-archive stages only', async () => {
    const user = userEvent.setup()
    const { onAction } = setup(mk())
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(onAction).toHaveBeenCalledWith('delete', expect.anything())
  })

  it('has no overflow menu in the archive and offers Restore / Find again', () => {
    const { unmount } = render(
      <JobDetail job={mk({ stage: 'archive' })} busy={false} onAction={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy()
    unmount()
    setup(mk({ stage: 'archive', deletedAt: new Date().toISOString() }))
    expect(screen.getByRole('button', { name: 'Find again' })).toBeTruthy()
    expect(screen.getByText(/The old draft and description are gone/)).toBeTruthy()
  })

  it('disables action buttons while busy', () => {
    setup(mk({ stage: 'ready' }), true)
    expect((screen.getByRole('button', { name: 'Mark as applied' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps link actions live while an action is busy', () => {
    setup(mk({ stage: 'applied' }), true)
    const link = screen.getByRole('link', { name: 'Open in Applications' })
    expect(link.getAttribute('aria-disabled')).toBeNull()
    expect(link.className).not.toMatch(/(^|\s)pointer-events-none/)
    cleanup()
    setup(mk({ stage: 'found', url: 'https://x.test/1' }), true)
    const posting = screen.getByRole('link', { name: 'Open posting' })
    expect(posting.getAttribute('aria-disabled')).toBeNull()
    expect(posting.className).not.toMatch(/(^|\s)pointer-events-none/)
  })

  it('calls onBack', () => {
    const { onBack } = setup(mk())
    fireEvent.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('open-applications is a real link', () => {
    setup(mk({ stage: 'applied' }))
    expect(screen.getByRole('link', { name: 'Open in Applications' }).getAttribute('href')).toBe('/dashboard/applications')
  })
})
