import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }))

vi.mock('@/lib/api/scraped-jobs', () => ({ listScrapedJobs: mockList }))

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: { user: { id: 'u1' } } })),
}))

import { GET } from './route'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/jobsearch/scraped-jobs', () => {
  it('lists scraped jobs for the given profileId', async () => {
    mockList.mockResolvedValue([{ _id: 'j1', title: 'Engineer' }])
    const req = new Request('http://test/api/jobsearch/scraped-jobs?profileId=p1')

    const res = (await GET(req as never, undefined as never)) as Response
    const body = await res.json()

    expect(mockList).toHaveBeenCalledWith('u1', 'p1')
    expect(body.scrapedJobs).toEqual([{ _id: 'j1', title: 'Engineer' }])
  })

  it('rejects a missing profileId with 400', async () => {
    const req = new Request('http://test/api/jobsearch/scraped-jobs')

    const res = (await GET(req as never, undefined as never)) as Response

    expect(res.status).toBe(400)
    expect(mockList).not.toHaveBeenCalled()
  })
})
