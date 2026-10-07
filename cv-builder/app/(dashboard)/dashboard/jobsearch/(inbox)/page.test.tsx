// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
}))

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))

const listProfilesMock = vi.fn()
vi.mock('@/lib/api/jobsearch-profiles', () => ({
  listJobSearchProfiles: (userId: string) => listProfilesMock(userId),
}))

const countMock = vi.fn()
const listJobsMock = vi.fn()
vi.mock('@/lib/api/scraped-jobs', () => ({
  countPipelineStages: (userId: string, opts: unknown) => countMock(userId, opts),
  listPipelineJobs: (userId: string, opts: unknown) => listJobsMock(userId, opts),
}))

vi.mock('@/components/pipeline/PipelineInbox', () => ({
  PipelineInbox: (props: unknown) => <div data-testid="inbox" data-props={JSON.stringify(props)} />,
}))

const counts = (over: Record<string, number> = {}) => ({
  found: 0, matched: 0, matchedUnread: 0, drafted: 0, ready: 0, applied: 0, archive: 0, ...over,
})

async function renderPage(searchParams: Record<string, string | string[]> = {}) {
  const { default: Page } = await import('./page')
  return render(await Page({ searchParams: Promise.resolve(searchParams) }))
}

describe('jobsearch pipeline page', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    listProfilesMock.mockResolvedValue([
      { _id: { toString: () => 'p1' }, name: 'Backend', isActive: true, extra: 'x' },
    ])
    countMock.mockResolvedValue(counts({ matched: 2, matchedUnread: 2 }))
    listJobsMock.mockResolvedValue({ items: [{ _id: 'j1', title: 'Dev', createdAt: new Date('2026-10-01T00:00:00.000Z') }], nextCursor: null })
  })
  afterEach(() => vi.clearAllMocks())

  it('redirects signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    const { default: Page } = await import('./page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
  })

  it('defaults to matched when there are unread matches', async () => {
    await renderPage()
    expect(countMock).toHaveBeenCalledWith('user-1', { profileId: undefined })
    expect(listJobsMock).toHaveBeenCalledWith('user-1', expect.objectContaining({ stage: 'matched', profileId: undefined }))
  })

  it('honours stage, profile and q from the URL', async () => {
    await renderPage({ stage: 'archive', profile: 'p1', q: 'x' })
    expect(countMock).toHaveBeenCalledWith('user-1', { profileId: 'p1' })
    expect(listJobsMock).toHaveBeenCalledWith('user-1', expect.objectContaining({ stage: 'archive', profileId: 'p1', q: 'x' }))
  })

  it('falls back to the default stage for an invalid ?stage', async () => {
    await renderPage({ stage: 'bogus' })
    expect(listJobsMock).toHaveBeenCalledWith('user-1', expect.objectContaining({ stage: 'matched' }))
  })

  it('ignores array-valued params instead of throwing', async () => {
    await renderPage({ stage: ['found', 'applied'], profile: ['p1', 'p2'], q: ['a', 'b'], job: ['j1', 'j2'] })
    expect(countMock).toHaveBeenCalledWith('user-1', { profileId: undefined })
    expect(listJobsMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ stage: 'matched', profileId: undefined, q: '' })
    )
  })

  it('scopes every data call to the session user', async () => {
    await renderPage({ stage: 'found' })
    for (const m of [listProfilesMock, countMock, listJobsMock]) {
      expect(m.mock.calls.every((c) => c[0] === 'user-1')).toBe(true)
      expect(m).toHaveBeenCalled()
    }
  })

  it('passes serialised data to the inbox', async () => {
    await renderPage({ profile: 'p1', q: 'x' })
    const props = JSON.parse(screen.getByTestId('inbox').getAttribute('data-props')!)
    expect(props.initial.view).toEqual({ stage: 'matched', profile: 'p1', q: 'x' })
    expect(props.initial.items[0].createdAt).toBe('2026-10-01T00:00:00.000Z')
    expect(props.initial.counts.matchedUnread).toBe(2)
    expect(props.initial.nextCursor).toBeNull()
    expect(props.profiles).toEqual([{ _id: 'p1', name: 'Backend', isActive: true }])
  })
})
