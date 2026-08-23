import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const { mockFind, mockInsertMany, mockCountDocuments, mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockInsertMany: vi.fn(),
  mockCountDocuments: vi.fn(),
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
}))

vi.mock('@/models/ScrapedJob', () => ({
  default: {
    find: mockFind,
    insertMany: mockInsertMany,
    countDocuments: mockCountDocuments,
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
  },
}))

const { mockCreateApplication } = vi.hoisted(() => ({ mockCreateApplication: vi.fn() }))
vi.mock('@/lib/api/applications', () => ({ createApplication: mockCreateApplication }))

import {
  listScrapedJobs,
  findExistingSourceIds,
  createScrapedJobs,
  countDraftedInWindow,
  listDraftQueueBacklog,
  markScrapedJobDrafted,
  convertScrapedJobToApplication,
} from '../scraped-jobs'

function sortLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(resolved) })) }
}
function leanChain(resolved: unknown) {
  return { lean: vi.fn().mockResolvedValue(resolved) }
}
function sortLimitLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => ({ limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(resolved) })) })) }
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
  it('stamps every job with userId and profileId before inserting, unordered', async () => {
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

    expect(mockInsertMany).toHaveBeenCalledWith(
      [expect.objectContaining({ userId: 'u1', profileId: 'p1', sourceId: 'a1' })],
      { ordered: false }
    )
  })

  it('does nothing when given an empty list', async () => {
    await createScrapedJobs('u1', 'p1', [])
    expect(mockInsertMany).not.toHaveBeenCalled()
  })

  it('swallows a duplicate-key-only bulk write error instead of throwing', async () => {
    const dupError = Object.assign(new Error('E11000 duplicate key error'), {
      writeErrors: [{ code: 11000, errmsg: 'dup' }],
    })
    mockInsertMany.mockRejectedValue(dupError)

    await expect(
      createScrapedJobs('u1', 'p1', [
        {
          source: 'freehire',
          sourceId: 'a1',
          title: 'Engineer',
          company: 'Acme',
          url: 'https://freehire.me/jobs/a1',
          description: 'Build things.',
        } as never,
      ])
    ).resolves.toBeUndefined()
  })

  it('rethrows a bulk write error that mixes in a non-duplicate-key failure', async () => {
    const mixedError = Object.assign(new Error('bulk write failed'), {
      writeErrors: [
        { code: 11000, errmsg: 'dup' },
        { code: 121, errmsg: 'document failed validation' },
      ],
    })
    mockInsertMany.mockRejectedValue(mixedError)

    await expect(
      createScrapedJobs('u1', 'p1', [
        {
          source: 'freehire',
          sourceId: 'a1',
          title: 'Engineer',
          company: 'Acme',
          url: 'https://freehire.me/jobs/a1',
          description: 'Build things.',
        } as never,
      ])
    ).rejects.toThrow('bulk write failed')
  })

  it('rethrows an error with no writeErrors at all (e.g. a connection failure)', async () => {
    mockInsertMany.mockRejectedValue(new Error('connection reset'))

    await expect(
      createScrapedJobs('u1', 'p1', [
        {
          source: 'freehire',
          sourceId: 'a1',
          title: 'Engineer',
          company: 'Acme',
          url: 'https://freehire.me/jobs/a1',
          description: 'Build things.',
        } as never,
      ])
    ).rejects.toThrow('connection reset')
  })
})

describe('countDraftedInWindow', () => {
  it('counts drafted jobs for a user within the window, scoped to a profile when given', async () => {
    mockCountDocuments.mockResolvedValue(2)

    const result = await countDraftedInWindow('u1', 'p1')

    expect(result).toBe(2)
    const query = mockCountDocuments.mock.calls[0][0]
    expect(query.userId).toBe('u1')
    expect(query.profileId).toBe('p1')
    expect(query.draftedAt.$gte).toBeInstanceOf(Date)
  })

  it('omits profileId from the query when not given (per-user aggregate)', async () => {
    mockCountDocuments.mockResolvedValue(5)

    await countDraftedInWindow('u1')

    const query = mockCountDocuments.mock.calls[0][0]
    expect(query.profileId).toBeUndefined()
  })
})

describe('listDraftQueueBacklog', () => {
  it('queries for undrafted draft_and_queue matches, sorted oldest-first, capped at limit', async () => {
    mockFind.mockReturnValue(sortLimitLeanChain([]))

    await listDraftQueueBacklog('u1', 'p1', 3)

    expect(mockFind).toHaveBeenCalledWith({
      userId: 'u1',
      profileId: 'p1',
      resolvedActions: 'draft_and_queue',
      draftedAt: { $exists: false },
      status: 'new',
    })
  })

  it('returns an empty array without querying when limit is 0', async () => {
    const result = await listDraftQueueBacklog('u1', 'p1', 0)

    expect(mockFind).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})

describe('markScrapedJobDrafted', () => {
  it('sets the drafted fields plus a fresh draftedAt', async () => {
    mockUpdateOne.mockResolvedValue({})

    await markScrapedJobDrafted('j1', {
      draftResumeId: 'r1',
      postTailorScore: 88,
      pendingApprovals: [],
      tailoredKeywords: ['Node'],
      status: 'queued',
    })

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'j1' },
      {
        $set: expect.objectContaining({
          draftResumeId: 'r1',
          postTailorScore: 88,
          status: 'queued',
          tailoredKeywords: ['Node'],
          draftedAt: expect.any(Date),
        }),
      }
    )
  })
})

describe('convertScrapedJobToApplication', () => {
  const baseJob = {
    draftResumeId: 'r1',
    status: 'queued',
    pendingApprovals: [] as string[],
    company: 'Acme',
    title: 'Backend Engineer',
  }

  it('returns NOT_FOUND when the job does not exist for this user', async () => {
    mockFindOne.mockReturnValue(leanChain(null))

    const result = await convertScrapedJobToApplication('u1', 'missing')

    expect(result).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Not found' })
  })

  it('returns NO_DRAFT when there is no draftResumeId yet', async () => {
    mockFindOne.mockReturnValue(leanChain({ ...baseJob, draftResumeId: undefined }))

    const result = await convertScrapedJobToApplication('u1', 'j1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NO_DRAFT')
  })

  it('returns ALREADY_SUBMITTED when status is already submitted', async () => {
    mockFindOne.mockReturnValue(leanChain({ ...baseJob, status: 'submitted' }))

    const result = await convertScrapedJobToApplication('u1', 'j1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ALREADY_SUBMITTED')
  })

  it('returns PENDING_APPROVALS when unresolved flagged claims remain', async () => {
    mockFindOne.mockReturnValue(leanChain({ ...baseJob, pendingApprovals: ['40%'] }))

    const result = await convertScrapedJobToApplication('u1', 'j1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('PENDING_APPROVALS')
  })

  it('creates the application, marks the job submitted, and returns it on success', async () => {
    mockFindOne.mockReturnValue(leanChain(baseJob))
    mockCreateApplication.mockResolvedValue({ _id: 'app1', company: 'Acme', role: 'Backend Engineer' })
    mockUpdateOne.mockResolvedValue({})

    const result = await convertScrapedJobToApplication('u1', 'j1')

    expect(mockCreateApplication).toHaveBeenCalledWith('u1', { resumeId: 'r1', company: 'Acme', role: 'Backend Engineer', customFields: {} })
    expect(mockUpdateOne).toHaveBeenCalledWith({ _id: 'j1', userId: 'u1' }, { $set: { status: 'submitted' } })
    expect(result).toEqual({ ok: true, application: { _id: 'app1', company: 'Acme', role: 'Backend Engineer' } })
  })
})
