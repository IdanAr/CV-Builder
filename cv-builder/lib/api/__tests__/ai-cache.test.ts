import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const { mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
}))

vi.mock('@/models/AiCache', () => ({
  default: { findOne: mockFindOne, updateOne: mockUpdateOne },
}))

import { aiCacheKey, readAiCache, writeAiCache } from '../ai-cache'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('aiCacheKey', () => {
  it('is stable for the same input and ignores whitespace differences', () => {
    expect(aiCacheKey('v1', 'Fraud Analyst\n\n  SQL')).toBe(aiCacheKey('v1', ' Fraud Analyst SQL '))
  })

  it('changes with the version tag or the text', () => {
    expect(aiCacheKey('v1', 'job')).not.toBe(aiCacheKey('v2', 'job'))
    expect(aiCacheKey('v1', 'job')).not.toBe(aiCacheKey('v1', 'other job'))
  })

  it('keeps part boundaries, so moving text between parts changes the key', () => {
    expect(aiCacheKey('ab', 'c')).not.toBe(aiCacheKey('a', 'bc'))
  })
})

describe('readAiCache', () => {
  it('returns the stored value, scoped to the user and kind', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ value: ['sql'] }) })
    await expect(readAiCache('u1', 'jd-requirements', 'k')).resolves.toEqual(['sql'])
    expect(mockFindOne).toHaveBeenCalledWith({ userId: 'u1', kind: 'jd-requirements', key: 'k' })
  })

  it('returns null on a miss', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    await expect(readAiCache('u1', 'jd-requirements', 'k')).resolves.toBeNull()
  })

  it('treats a database error as a miss instead of throwing', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('down')) })
    await expect(readAiCache('u1', 'jd-requirements', 'k')).resolves.toBeNull()
  })
})

describe('writeAiCache', () => {
  it('upserts the value and refreshes its age', async () => {
    mockUpdateOne.mockResolvedValue({})
    await writeAiCache('u1', 'synonym-matches', 'k', [{ keyword: 'sql' }])
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { userId: 'u1', kind: 'synonym-matches', key: 'k' },
      { $set: { value: [{ keyword: 'sql' }], createdAt: expect.any(Date) } },
      { upsert: true },
    )
  })

  it('swallows a database error', async () => {
    mockUpdateOne.mockRejectedValue(new Error('down'))
    await expect(writeAiCache('u1', 'synonym-matches', 'k', [])).resolves.toBeUndefined()
  })
})
