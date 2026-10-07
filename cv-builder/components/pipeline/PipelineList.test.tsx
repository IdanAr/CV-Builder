// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PipelineList } from './PipelineList'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'

const mk = (id: string, over: Partial<PipelineJob> = {}): PipelineJob => ({
  _id: id, profileId: 'p', title: `Job ${id}`, company: 'Acme', url: 'u', matchedRules: [],
  pendingApprovals: [], tailoredKeywords: [], status: 'new', stage: 'found',
  createdAt: new Date().toISOString(), ...over,
})

function setup(over: Partial<React.ComponentProps<typeof PipelineList>> = {}) {
  const props: React.ComponentProps<typeof PipelineList> = {
    stage: 'found', status: 'ready', items: [mk('a'), mk('b')], selectedId: null,
    unreadIds: new Set<string>(), nextCursor: null, loadingMore: false, hasFilters: false,
    onSelect: vi.fn(), onLoadMore: vi.fn(), onRetry: vi.fn(), error: null, ...over,
  }
  render(<PipelineList {...props} />)
  return props
}

describe('PipelineList', () => {
  it('renders a labelled plain list with every row button tabbable and no live region', () => {
    setup()
    const list = screen.getByRole('list', { name: 'Jobs' })
    expect(list.getAttribute('aria-live')).toBeNull()
    // list-style:none drops the implicit role in Safari/VoiceOver, so it is explicit.
    expect(list.getAttribute('role')).toBe('list')
    expect(list.tabIndex).toBe(-1)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByRole('button').map((b) => b.tabIndex)).toEqual([0, 0])
  })

  it('marks only the selected row with aria-current', () => {
    setup({ selectedId: 'b' })
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-current'))).toEqual([null, 'true'])
  })

  it('calls onSelect with the id and flags unread rows as New', async () => {
    const p = setup({ unreadIds: new Set(['a']) })
    expect(screen.getByText('New')).toBeTruthy()
    await userEvent.click(screen.getByText('Job b'))
    expect(p.onSelect).toHaveBeenCalledWith('b')
  })

  it('shows a loading status with skeletons', () => {
    setup({ status: 'loading', items: [] })
    expect(screen.getByRole('status').textContent).toContain('Loading jobs')
  })

  it('shows error with retry only when there are no items', async () => {
    const p = setup({ status: 'error', items: [], error: 'Boom' })
    expect(screen.getByRole('alert').textContent).toContain('Boom')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(p.onRetry).toHaveBeenCalled()
  })

  it.each([
    ['found', 'Nothing found yet. Run a scan to look for new postings.'],
    ['matched', 'No matches to review. Matches appear here when a rule flags a posting.'],
    ['drafted', 'No drafts to review. Drafts appear here when a rule prepares an application.'],
    ['ready', 'Nothing ready to apply. Approved drafts wait here until you mark them applied.'],
    ['applied', 'No applications yet. Jobs you mark as applied are tracked here.'],
    ['archive', 'Nothing in the archive. Dismissed and deleted postings land here.'],
  ] as const)('empty copy for %s', (stage, copy) => {
    setup({ stage, items: [] })
    expect(screen.getByText(copy)).toBeTruthy()
  })

  it('uses the filter copy when filters are active', () => {
    setup({ items: [], hasFilters: true })
    expect(screen.getByText('No jobs match these filters.')).toBeTruthy()
  })

  it('loads more, disabled while loading', async () => {
    const p = setup({ nextCursor: 'c' })
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(p.onLoadMore).toHaveBeenCalled()
  })

  it('disables Load more with Loading… while loading more', () => {
    setup({ nextCursor: 'c', loadingMore: true })
    expect((screen.getByRole('button', { name: 'Loading…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('notes tombstones once in the archive', () => {
    const t = new Date().toISOString()
    setup({ stage: 'archive', items: [mk('a', { stage: 'archive', deletedAt: t }), mk('b', { stage: 'archive', deletedAt: t })] })
    expect(screen.getAllByText('Scans skip these, so they are never tailored again.')).toHaveLength(1)
  })
})
