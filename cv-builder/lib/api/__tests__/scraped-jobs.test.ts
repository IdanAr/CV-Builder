import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const { mockFind, mockInsertMany } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockInsertMany: vi.fn(),
}))

vi.mock('@/models/ScrapedJob', () => ({
  default: {
    find: mockFind,
    insertMany: mockInsertMany,
  },
}))

import { listScrapedJobs, findExistingSourceIds, createScrapedJobs } from '../scraped-jobs'

function sortLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(resolved) })) }
}
function leanChain(resolved: unknown) {
  return { lean: vi.fn().mockResolvedValue(resolved) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listScrapedJobs', () => {
  it('scopes the query to userId and profileId, newest first', async () => {
    const jobs = [{ _id: 'j1', userId: 'u1', profileId: 'p1', title: 'Engineer' }]
    mockFind.mockReturnValue(sortLeanChain(jobs))

    const result = await listScrapedJobs('u1', 'p1')

    expect(mockFind).toHaveBeenCalledWith({ userId: 'u1', profileId: 'p1' })
    expect(result).toEqual(jobs)
  })
})

describe('findExistingSourceIds', () => {
  it('returns a Set of sourceIds already stored for this profile+source', async () => {
    mockFind.mockReturnValue(leanChain([{ sourceId: 'a1' }, { sourceId: 'a2' }]))

    const result = await findExistingSourceIds('u1', 'p1', 'freehire', ['a1', 'a2', 'a3'])

    expect(mockFind).toHaveBeenCalledWith(
      { userId: 'u1', profileId: 'p1', source: 'freehire', sourceId: { $in: ['a1', 'a2', 'a3'] } },
      'sourceId'
    )
    expect(result).toEqual(new Set(['a1', 'a2']))
  })

  it('returns an empty Set without querying when given no sourceIds', async () => {
    const result = await findExistingSourceIds('u1', 'p1', 'freehire', [])

    expect(mockFind).not.toHaveBeenCalled()
    expect(result).toEqual(new Set())
  })
})

describe('createScrapedJobs', () => {
  it('stamps every job with userId and profileId before inserting', async () => {
    mockInsertMany.mockResolvedValue([])

    await createScrapedJobs('u1', 'p1', [
      {
        source: 'freehire',
        sourceId: 'a1',
        title: 'Engineer',
        company: 'Acme',
        url: 'https://freehire.me/jobs/a1',
        description: 'Build things.',
      } as never,
    ])

    expect(mockInsertMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'u1', profileId: 'p1', sourceId: 'a1' }),
    ])
  })

  it('does nothing when given an empty list', async () => {
    await createScrapedJobs('u1', 'p1', [])
    expect(mockInsertMany).not.toHaveBeenCalled()
  })
})
