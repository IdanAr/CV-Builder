import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const {
  mockFind,
  mockCreate,
  mockFindOne,
  mockFindOneAndUpdate,
  mockDeleteOne,
  mockProfileFindOne,
} = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockCreate: vi.fn(),
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockDeleteOne: vi.fn(),
  mockProfileFindOne: vi.fn(),
}))

vi.mock('@/models/JobSearchRule', () => ({
  default: {
    find: mockFind,
    create: mockCreate,
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
    deleteOne: mockDeleteOne,
  },
}))

vi.mock('@/models/JobSearchProfile', () => ({
  default: { findOne: mockProfileFindOne },
}))

import {
  listRulesForProfile,
  createJobSearchRule,
  getJobSearchRule,
  updateJobSearchRule,
  deleteJobSearchRule,
} from '../jobsearch-rules'

function sortLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(resolved) })) }
}
function leanChain(resolved: unknown) {
  return { lean: vi.fn().mockResolvedValue(resolved) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listRulesForProfile', () => {
  it('queries rules scoped to this profile or global, ordered', async () => {
    const rules = [{ _id: 'r1', userId: 'u1', profileId: 'p1' }]
    mockFind.mockReturnValue(sortLeanChain(rules))

    const result = await listRulesForProfile('u1', 'p1')

    expect(mockFind).toHaveBeenCalledWith({ userId: 'u1', $or: [{ profileId: 'p1' }, { profileId: null }] })
    expect(result).toEqual(rules)
  })
})

describe('createJobSearchRule', () => {
  it('creates a global rule (profileId null) without an ownership check', async () => {
    mockCreate.mockResolvedValue({ _id: 'r1', userId: 'u1', profileId: null })

    const result = await createJobSearchRule('u1', { profileId: null, name: 'Test', conditions: [], action: 'notify' } as never)

    expect(mockProfileFindOne).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith({ profileId: null, name: 'Test', conditions: [], action: 'notify', userId: 'u1' })
    expect(result).toEqual({ _id: 'r1', userId: 'u1', profileId: null })
  })

  it('creates a profile-scoped rule when the profile belongs to the caller', async () => {
    mockProfileFindOne.mockReturnValue(leanChain({ _id: 'p1', userId: 'u1' }))
    mockCreate.mockResolvedValue({ _id: 'r1', userId: 'u1', profileId: 'p1' })

    const result = await createJobSearchRule('u1', { profileId: 'p1', name: 'Test', conditions: [], action: 'notify' } as never)

    expect(mockProfileFindOne).toHaveBeenCalledWith({ _id: 'p1', userId: 'u1' })
    expect(result).toEqual({ _id: 'r1', userId: 'u1', profileId: 'p1' })
  })

  it('rejects (returns null) when profileId does not belong to the caller, without creating anything', async () => {
    mockProfileFindOne.mockReturnValue(leanChain(null))

    const result = await createJobSearchRule('u1', { profileId: 'not-mine', name: 'Test', conditions: [], action: 'notify' } as never)

    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('getJobSearchRule', () => {
  it('scopes lookup to id and userId together', async () => {
    mockFindOne.mockReturnValue(leanChain({ _id: 'r1', userId: 'u1' }))
    await getJobSearchRule('u1', 'r1')
    expect(mockFindOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
  })
})

describe('updateJobSearchRule', () => {
  it('applies a partial patch scoped to id and userId', async () => {
    mockFindOneAndUpdate.mockReturnValue(leanChain({ _id: 'r1', userId: 'u1', isActive: false }))

    await updateJobSearchRule('u1', 'r1', { isActive: false })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' }, { $set: { isActive: false } }, { new: true })
    expect(mockProfileFindOne).not.toHaveBeenCalled()
  })

  it('allows patching profileId to null (making a rule global) without an ownership check', async () => {
    mockFindOneAndUpdate.mockReturnValue(leanChain({ _id: 'r1', userId: 'u1', profileId: null }))

    await updateJobSearchRule('u1', 'r1', { profileId: null })

    expect(mockProfileFindOne).not.toHaveBeenCalled()
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' }, { $set: { profileId: null } }, { new: true })
  })

  it('keeps a new profileId that belongs to the caller', async () => {
    mockProfileFindOne.mockReturnValue(leanChain({ _id: 'p2', userId: 'u1' }))
    mockFindOneAndUpdate.mockReturnValue(leanChain({ _id: 'r1', userId: 'u1', profileId: 'p2' }))

    await updateJobSearchRule('u1', 'r1', { profileId: 'p2' })

    expect(mockProfileFindOne).toHaveBeenCalledWith({ _id: 'p2', userId: 'u1' })
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' }, { $set: { profileId: 'p2' } }, { new: true })
  })

  it('silently drops a new profileId that does not belong to the caller, leaving the rest of the patch intact', async () => {
    mockProfileFindOne.mockReturnValue(leanChain(null))
    mockFindOneAndUpdate.mockReturnValue(leanChain({ _id: 'r1', userId: 'u1' }))

    await updateJobSearchRule('u1', 'r1', { profileId: 'not-mine', isActive: false })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' }, { $set: { isActive: false } }, { new: true })
  })
})

describe('deleteJobSearchRule', () => {
  it('returns true when a document was actually deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 })
    expect(await deleteJobSearchRule('u1', 'r1')).toBe(true)
  })

  it('returns false when nothing matched', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 0 })
    expect(await deleteJobSearchRule('u1', 'r1')).toBe(false)
  })
})
