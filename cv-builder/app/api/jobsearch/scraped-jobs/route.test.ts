import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockList, mockPipeline, mockCounts } = vi.hoisted(() => ({
  mockList: vi.fn(), mockPipeline: vi.fn(), mockCounts: vi.fn(),
}))

vi.mock('@/lib/api/scraped-jobs', () => {
  class InvalidCursorError extends Error {}
  return { listScrapedJobs: mockList, listPipelineJobs: mockPipeline, countPipelineStages: mockCounts, InvalidCursorError }
})

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

    expect(mockList).toHaveBeenCalledWith('u1', 'p1', { includeDeleted: false })
    expect(body.scrapedJobs).toEqual([{ _id: 'j1', title: 'Engineer' }])
  })

  it('passes includeDeleted through when the Deleted filter asks for it', async () => {
    mockList.mockResolvedValue([])
    const req = new Request('http://test/api/jobsearch/scraped-jobs?profileId=p1&includeDeleted=1')

    await GET(req as never, undefined as never)

    expect(mockList).toHaveBeenCalledWith('u1', 'p1', { includeDeleted: true })
  })

  it('rejects a missing profileId with 400', async () => {
    const req = new Request('http://test/api/jobsearch/scraped-jobs')

    const res = (await GET(req as never, undefined as never)) as Response

    expect(res.status).toBe(400)
    expect(mockList).not.toHaveBeenCalled()
  })
})

describe('GET pipeline mode', () => {
  const get = async (qs: string) => (await GET(new Request(`http://test/api/jobsearch/scraped-jobs?${qs}`) as never, undefined as never)) as Response

  it('returns items, cursor and counts scoped to the session user', async () => {
    mockPipeline.mockResolvedValue({ items: [{ _id: 'j1' }], nextCursor: 'c2' })
    mockCounts.mockResolvedValue({ found: 1, archive: 0 })
    const res = await get('stage=matched&profileId=p1&q=eng&cursor=c1&limit=10')
    expect(res.status).toBe(200)
    expect(mockPipeline).toHaveBeenCalledWith('u1', { stage: 'matched', profileId: 'p1', q: 'eng', cursor: 'c1', limit: 10 })
    expect(mockCounts).toHaveBeenCalledWith('u1', { profileId: 'p1' })
    expect(await res.json()).toEqual({ items: [{ _id: 'j1' }], nextCursor: 'c2', counts: { found: 1, archive: 0 } })
  })
  it('does not require a profile in pipeline mode', async () => {
    mockPipeline.mockResolvedValue({ items: [], nextCursor: null })
    mockCounts.mockResolvedValue({})
    expect((await get('stage=found')).status).toBe(200)
    expect(mockPipeline).toHaveBeenCalledWith('u1', { stage: 'found', profileId: undefined, q: undefined, cursor: undefined, limit: undefined })
    expect(mockCounts).toHaveBeenCalledWith('u1', { profileId: undefined })
  })
  it('rejects an unknown stage with 400', async () => {
    expect((await get('stage=bogus')).status).toBe(400)
  })
  it('rejects a non-numeric limit with 400', async () => {
    expect((await get('stage=found&limit=abc')).status).toBe(400)
  })
  it('maps a malformed cursor to 400', async () => {
    const { InvalidCursorError } = await import('@/lib/api/scraped-jobs')
    mockPipeline.mockRejectedValue(new InvalidCursorError())
    mockCounts.mockResolvedValue({})
    expect((await get('stage=found&cursor=zzz')).status).toBe(400)
  })
  it('keeps the legacy shape when stage is absent (R7)', async () => {
    mockList.mockResolvedValue([{ _id: 'j1' }])
    const res = await get('profileId=p1')
    expect((await res.json()).scrapedJobs).toEqual([{ _id: 'j1' }])
    expect(mockPipeline).not.toHaveBeenCalled()
  })
})
