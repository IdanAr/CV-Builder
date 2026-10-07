import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error('NEXT_REDIRECT')
  },
}))
const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))

async function runId(tab?: string) {
  const { default: Page } = await import('./[id]/page')
  await expect(
    Page({ params: Promise.resolve({ id: 'p1' }), searchParams: Promise.resolve({ tab }) })
  ).rejects.toThrow('NEXT_REDIRECT')
}

describe('legacy jobsearch redirects', () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: 'user-1' } }))
  afterEach(() => vi.clearAllMocks())

  it.each([
    [undefined, '/dashboard/jobsearch/sources/p1'],
    ['rules', '/dashboard/jobsearch/sources/p1'],
    ['bogus', '/dashboard/jobsearch/sources/p1'],
    ['jobs', '/dashboard/jobsearch?profile=p1'],
    ['matches', '/dashboard/jobsearch?profile=p1'],
  ])('[id] with tab=%s goes to %s', async (tab, target) => {
    await runId(tab)
    expect(redirectMock).toHaveBeenCalledWith(target)
  })

  it('[id] sends signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    await runId('jobs')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
    expect(redirectMock).toHaveBeenCalledTimes(1)
  })

  it('notifications goes to the matched stage', async () => {
    const { default: Page } = await import('./notifications/page')
    await expect(Page()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/jobsearch?stage=matched')
  })

  it('notifications sends signed-out visitors to /signin', async () => {
    authMock.mockResolvedValue(null)
    const { default: Page } = await import('./notifications/page')
    await expect(Page()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/signin')
    expect(redirectMock).toHaveBeenCalledTimes(1)
  })
})
