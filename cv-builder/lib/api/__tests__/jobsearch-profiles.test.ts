import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const {
  mockFind,
  mockCreate,
  mockFindOne,
  mockFindOneAndUpdate,
  mockDeleteOne,
  mockResumeFindOne,
} = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockCreate: vi.fn(),
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockDeleteOne: vi.fn(),
  mockResumeFindOne: vi.fn(),
}))

vi.mock('@/models/JobSearchProfile', () => ({
  default: {
    find: mockFind,
    create: mockCreate,
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
    deleteOne: mockDeleteOne,
  },
}))

vi.mock('@/models/Resume', () => ({
  default: {
    findOne: mockResumeFindOne,
  },
}))

import {
  listJobSearchProfiles,
  createJobSearchProfile,
  getJobSearchProfile,
  updateJobSearchProfile,
  deleteJobSearchProfile,
} from '../jobsearch-profiles'

function sortLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(resolved) })) }
}
function leanChain(resolved: unknown) {
  return { lean: vi.fn().mockResolvedValue(resolved) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listJobSearchProfiles', () => {
  it('scopes the query to the requesting user, oldest first', async () => {
    const profiles = [{ _id: 'p1', userId: 'u1', name: 'Frontend' }]
    mockFind.mockReturnValue(sortLeanChain(profiles))

    const result = await listJobSearchProfiles('u1')

    expect(mockFind).toHaveBeenCalledWith({ userId: 'u1' })
    expect(result).toEqual(profiles)
  })
})

describe('createJobSearchProfile', () => {
  it('stamps the input with the requesting userId', async () => {
    mockCreate.mockResolvedValue({ _id: 'p1', userId: 'u1', name: 'Frontend' })
    mockResumeFindOne.mockReturnValue(leanChain(null))

    await createJobSearchProfile('u1', { name: 'Frontend' } as never)

    expect(mockCreate).toHaveBeenCalledWith({ name: 'Frontend', resumeId: undefined, userId: 'u1' })
  })

  it('keeps a resumeId that belongs to the caller', async () => {
    mockCreate.mockResolvedValue({ _id: 'p1', userId: 'u1', name: 'Frontend', resumeId: 'r1' })
    mockResumeFindOne.mockReturnValue(leanChain({ _id: 'r1', userId: 'u1' }))

    await createJobSearchProfile('u1', { name: 'Frontend', resumeId: 'r1' } as never)

    expect(mockResumeFindOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
    expect(mockCreate).toHaveBeenCalledWith({ name: 'Frontend', resumeId: 'r1', userId: 'u1' })
  })

  it('silently drops a resumeId that does not belong to the caller', async () => {
    mockCreate.mockResolvedValue({ _id: 'p1', userId: 'u1', name: 'Frontend' })
    mockResumeFindOne.mockReturnValue(leanChain(null))

    await createJobSearchProfile('u1', { name: 'Frontend', resumeId: 'r-not-mine' } as never)

    expect(mockCreate).toHaveBeenCalledWith({ name: 'Frontend', resumeId: undefined, userId: 'u1' })
  })
})

describe('getJobSearchProfile', () => {
  it('scopes lookup to id and userId together', async () => {
    mockFindOne.mockReturnValue(leanChain({ _id: 'p1', userId: 'u1' }))

    await getJobSearchProfile('u1', 'p1')

    expect(mockFindOne).toHaveBeenCalledWith({ _id: 'p1', userId: 'u1' })
  })

  it('returns null when the profile belongs to a different user', async () => {
    mockFindOne.mockReturnValue(leanChain(null))

    const result = await getJobSearchProfile('u1', 'p1')

    expect(result).toBeNull()
  })
})

describe('updateJobSearchProfile', () => {
  it('applies a partial patch scoped to id and userId', async () => {
    mockFindOneAndUpdate.mockReturnValue(leanChain({ _id: 'p1', userId: 'u1', minAtsScore: 80 }))

    await updateJobSearchProfile('u1', 'p1', { minAtsScore: 80 })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'p1', userId: 'u1' },
      { $set: { minAtsScore: 80 } },
      { new: true }
    )
    expect(mockResumeFindOne).not.toHaveBeenCalled()
  })

  it('keeps a resumeId that belongs to the caller', async () => {
    mockResumeFindOne.mockReturnValue(leanChain({ _id: 'r1', userId: 'u1' }))
    mockFindOneAndUpdate.mockReturnValue(leanChain({ _id: 'p1', userId: 'u1', resumeId: 'r1' }))

    await updateJobSearchProfile('u1', 'p1', { resumeId: 'r1' })

    expect(mockResumeFindOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'p1', userId: 'u1' },
      { $set: { resumeId: 'r1' } },
      { new: true }
    )
  })

  it('silently drops a resumeId that does not belong to the caller, without erroring', async () => {
    mockResumeFindOne.mockReturnValue(leanChain(null))
    mockFindOneAndUpdate.mockReturnValue(leanChain({ _id: 'p1', userId: 'u1' }))

    await updateJobSearchProfile('u1', 'p1', { resumeId: 'r-not-mine', minAtsScore: 80 })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'p1', userId: 'u1' },
      { $set: { minAtsScore: 80 } },
      { new: true }
    )
  })
})

describe('deleteJobSearchProfile', () => {
  it('returns true when a document was actually deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 })
    expect(await deleteJobSearchProfile('u1', 'p1')).toBe(true)
  })

  it('returns false when nothing matched (wrong user or missing id)', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 0 })
    expect(await deleteJobSearchProfile('u1', 'p1')).toBe(false)
  })
})
