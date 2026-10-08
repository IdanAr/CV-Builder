import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPipeline, mockCounts } = vi.hoisted(() => ({
  mockPipeline: vi.fn(), mockCounts: vi.fn(),
}))

vi.mock('@/lib/api/scraped-jobs', () => {
  class InvalidCursorError extends Error {}
  return { listPipelineJobs: mockPipeline, countPipelineStages: mockCounts, InvalidCursorError }
})

vi.mock('@/lib/auth', () => ({
  auth: (handler: (req: unknown) => unknown) => (req: unknown) =>
    handler(Object.assign(req as object, { auth: { user: { id: 'u1' } } })),
}))

import { GET } from './route'

beforeEach(() => vi.clearAllMocks())

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
  it('no stage returns 400 VALIDATION_ERROR and never calls the data layer', async () => {
    for (const qs of ['', 'profileId=p1', 'profileId=p1&includeDeleted=1']) {
      const res = await get(qs)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'VALIDATION_ERROR', error: 'stage is required' })
    }
    expect(mockPipeline).not.toHaveBeenCalled()
    expect(mockCounts).not.toHaveBeenCalled()
  })
})
