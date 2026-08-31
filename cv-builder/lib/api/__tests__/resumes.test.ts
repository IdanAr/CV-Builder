import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db connection
vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

// Use vi.hoisted so mock references are available when the factory is hoisted
const { mockSort, mockLean, mockFind, mockFindOne, mockCreate, mockFindOneAndUpdate, mockDeleteOne, mockBulkWrite } =
  vi.hoisted(() => {
    const mockSort = vi.fn()
    const mockLean = vi.fn()
    const mockFind = vi.fn(() => ({ sort: mockSort }))
    const mockFindOne = vi.fn()
    const mockCreate = vi.fn()
    const mockFindOneAndUpdate = vi.fn()
    const mockDeleteOne = vi.fn()
    const mockBulkWrite = vi.fn()
    return { mockSort, mockLean, mockFind, mockFindOne, mockCreate, mockFindOneAndUpdate, mockDeleteOne, mockBulkWrite }
  })

vi.mock('@/models/Resume', () => ({
  default: {
    find: mockFind,
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
    deleteOne: mockDeleteOne,
    bulkWrite: mockBulkWrite,
  },
}))

import { listResumes, getResume, createResume, patchResume, deleteResume, duplicateResume } from '../resumes'

beforeEach(() => vi.clearAllMocks())

describe('listResumes', () => {
  it('handles resumes with undefined data gracefully', async () => {
    const fakeResumes = [{ _id: 'r2', userId: 'u1', title: 'Empty', data: undefined, meta: {} }]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')
    expect(result[0].sectionsFilledCount).toBe(0)
    expect(result[0].formatScore).toBeDefined()
  })

  it('queries by userId and returns resumes with sectionsFilledCount', async () => {
    const fakeResumes = [
      {
        _id: 'r1',
        userId: 'u1',
        title: 'My CV',
        data: { work: [{ name: 'Acme' }], education: [{ institution: 'MIT' }] },
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')

    expect(mockFind).toHaveBeenCalledWith({ userId: 'u1' })
    expect(result).toHaveLength(1)
    expect(result[0].sectionsFilledCount).toBe(2)
    expect(result[0].formatScore).toBeDefined()
  })

  it('attaches parentResumeTitle when the parent is present in the same result set', async () => {
    const fakeResumes = [
      { _id: 'r1', userId: 'u1', title: 'Original CV', data: {}, meta: {} },
      { _id: 'r2', userId: 'u1', title: 'Copy of Original CV', data: {}, meta: {}, parentResumeId: 'r1' },
    ]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')

    expect(result[0].parentResumeTitle).toBeUndefined()
    expect(result[1].parentResumeTitle).toBe('Original CV')
    // No extra DB query/lookup should be issued for resolving parent titles.
    expect(mockFind).toHaveBeenCalledTimes(1)
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('resolves parentResumeTitle to undefined when the parent was since deleted', async () => {
    const fakeResumes = [
      { _id: 'r2', userId: 'u1', title: 'Copy of Deleted CV', data: {}, meta: {}, parentResumeId: 'gone' },
    ]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')

    expect(result[0].parentResumeTitle).toBeUndefined()
  })

  it('reuses a cached formatScore when it is newer than the last edit, without a DB write', async () => {
    const updatedAt = new Date('2026-01-01T00:00:00Z')
    const computedAt = new Date('2026-01-02T00:00:00Z') // after updatedAt — fresh
    const fakeResumes = [
      {
        _id: 'r1', userId: 'u1', title: 'My CV', data: {}, meta: {},
        updatedAt, cachedFormatScore: 17, formatScoreComputedAt: computedAt,
      },
    ]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')

    expect(result[0].formatScore).toBe(17)
    expect(mockBulkWrite).not.toHaveBeenCalled()
  })

  it('recomputes and persists when the cache predates the last edit', async () => {
    const updatedAt = new Date('2026-01-02T00:00:00Z')
    const computedAt = new Date('2026-01-01T00:00:00Z') // before updatedAt — stale
    const fakeResumes = [
      {
        _id: 'r1', userId: 'u1', title: 'My CV', data: {}, meta: {},
        updatedAt, cachedFormatScore: 5, formatScoreComputedAt: computedAt,
      },
    ]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')

    // A brand-new, empty `data` object always scores the same fixed formatScore
    // regardless of the (now-stale) cached 5 — the exact value doesn't matter
    // here, only that it was recomputed (not the stale cached 5) and persisted.
    expect(result[0].formatScore).not.toBe(5)
    expect(mockBulkWrite).toHaveBeenCalledWith(
      [
        { updateOne: { filter: { _id: 'r1' }, update: { $set: { cachedFormatScore: result[0].formatScore, formatScoreComputedAt: expect.any(Date) } } } },
      ],
      { timestamps: false }
    )
  })

  it('recomputes and persists when there is no cached score yet', async () => {
    const fakeResumes = [{ _id: 'r1', userId: 'u1', title: 'My CV', data: {}, meta: {}, updatedAt: new Date() }]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    const result = await listResumes('u1')

    expect(result[0].formatScore).toBeDefined()
    expect(mockBulkWrite).toHaveBeenCalledTimes(1)
  })

  it('batches multiple stale/missing-cache resumes into a single bulkWrite call', async () => {
    const fakeResumes = [
      { _id: 'r1', userId: 'u1', title: 'A', data: {}, meta: {}, updatedAt: new Date() },
      { _id: 'r2', userId: 'u1', title: 'B', data: {}, meta: {}, updatedAt: new Date() },
    ]
    mockSort.mockReturnValue({ lean: mockLean })
    mockLean.mockResolvedValue(fakeResumes)

    await listResumes('u1')

    expect(mockBulkWrite).toHaveBeenCalledTimes(1)
    expect(mockBulkWrite.mock.calls[0][0]).toHaveLength(2)
  })
})

describe('getResume', () => {
  it('queries by _id and userId', async () => {
    const fakeResume = { _id: 'r1', userId: 'u1', title: 'My CV', data: {}, meta: {} }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(fakeResume) })

    const result = await getResume('u1', 'r1')

    expect(mockFindOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
    expect(result).toEqual(fakeResume)
  })

  it('returns null when not found', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const result = await getResume('u1', 'nonexistent')
    expect(result).toBeNull()
  })
})

describe('createResume', () => {
  it('creates resume with userId and input', async () => {
    const input = {
      title: 'New CV',
      data: {},
      meta: {
        templateId: 'classic',
        fontFamily: 'Calibri',
        headerFontFamily: 'Calibri',
        primaryColor: '#000000',
        accentColor: '#0066cc',
        pageMargins: 1.0, sidebarRailWidth: 33,
        lineSpacing: 1.15,
        sectionOrder: [] as string[],
        layout: 'single-column' as const,
        columnAssignment: {},
        excludedAtsKeywords: [],
      },
      applicationStatus: 'draft' as const,
    }
    const created = { _id: 'r2', userId: 'u1', ...input }
    mockCreate.mockResolvedValue({ toObject: () => created })

    const result = await createResume('u1', input)

    expect(mockCreate).toHaveBeenCalledWith({ userId: 'u1', ...input })
    expect(result).toEqual(created)
  })

  it('records parentResumeId when passed via options, for job-search tailored drafts', async () => {
    const input = { title: 'Tailored CV', data: {}, meta: {}, applicationStatus: 'draft' as const }
    mockCreate.mockResolvedValue({ toObject: () => ({ _id: 'r3', userId: 'u1', ...input }) })

    await createResume('u1', input as never, { parentResumeId: 'r1' })

    expect(mockCreate).toHaveBeenCalledWith({ userId: 'u1', ...input, parentResumeId: 'r1' })
  })
})

describe('patchResume', () => {
  it('uses $set with dot-notation for meta fields', async () => {
    const updated = { _id: 'r1', title: 'My CV', meta: { fontFamily: 'Arial' } }
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(updated) })

    await patchResume('u1', 'r1', { meta: { fontFamily: 'Arial' } })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'r1', userId: 'u1' },
      { $set: { 'meta.fontFamily': 'Arial' } },
      { new: true }
    )
  })

  it('sets data directly (full replacement) when provided', async () => {
    const newData = { work: [{ name: 'NewCo' }] }
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) })

    await patchResume('u1', 'r1', { data: newData })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'r1', userId: 'u1' },
      { $set: { data: newData } },
      { new: true }
    )
  })

  it('returns null when document does not exist', async () => {
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const result = await patchResume('u1', 'nonexistent', { title: 'X' })
    expect(result).toBeNull()
  })

  it('sets applicationStatus via $set the same way title is handled', async () => {
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) })

    await patchResume('u1', 'r1', { applicationStatus: 'applied' })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'r1', userId: 'u1' },
      { $set: { applicationStatus: 'applied' } },
      { new: true }
    )
  })

  it('sets targetCompany and targetRole via $set the same way title is handled', async () => {
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) })

    await patchResume('u1', 'r1', { targetCompany: 'Acme Inc', targetRole: 'Engineer' })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'r1', userId: 'u1' },
      { $set: { targetCompany: 'Acme Inc', targetRole: 'Engineer' } },
      { new: true }
    )
  })
})

describe('deleteResume', () => {
  it('returns true when a document was deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 })
    const result = await deleteResume('u1', 'r1')
    expect(result).toBe(true)
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
  })

  it('returns false when nothing was deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 0 })
    const result = await deleteResume('u1', 'r1')
    expect(result).toBe(false)
  })
})

describe('duplicateResume', () => {
  it('creates a copy with "Copy of" prefix in title', async () => {
    const source = {
      _id: 'r1',
      userId: 'u1',
      title: 'My CV',
      data: { work: [] },
      meta: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(source) })
    const copy = { _id: 'r2', userId: 'u1', title: 'Copy of My CV', data: source.data, meta: source.meta }
    mockCreate.mockResolvedValue({ toObject: () => copy })

    const result = await duplicateResume('u1', 'r1')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Copy of My CV', userId: 'u1' })
    )
    expect(result).toEqual(copy)
  })

  it('returns null when source resume not found', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const result = await duplicateResume('u1', 'nonexistent')
    expect(result).toBeNull()
  })

  it('sets parentResumeId to the source id and resets applicationStatus to draft even if the source had a different status', async () => {
    const source = {
      _id: 'r1',
      userId: 'u1',
      title: 'My CV',
      data: { work: [] },
      meta: {},
      applicationStatus: 'applied',
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(source) })
    mockCreate.mockResolvedValue({ toObject: () => ({}) })

    await duplicateResume('u1', 'r1')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ parentResumeId: 'r1', applicationStatus: 'draft' })
    )
  })

  it('applies overrides.targetCompany/targetRole when provided', async () => {
    const source = {
      _id: 'r1',
      userId: 'u1',
      title: 'My CV',
      data: {},
      meta: {},
      applicationStatus: 'draft',
      targetCompany: 'Old Co',
      targetRole: 'Old Role',
    }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(source) })
    mockCreate.mockResolvedValue({ toObject: () => ({}) })

    await duplicateResume('u1', 'r1', { targetCompany: 'New Co', targetRole: 'New Role' })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ targetCompany: 'New Co', targetRole: 'New Role' })
    )
  })

  it('falls back to the source own targetCompany/targetRole when overrides are not provided', async () => {
    const source = {
      _id: 'r1',
      userId: 'u1',
      title: 'My CV',
      data: {},
      meta: {},
      applicationStatus: 'draft',
      targetCompany: 'Existing Co',
      targetRole: 'Existing Role',
    }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(source) })
    mockCreate.mockResolvedValue({ toObject: () => ({}) })

    await duplicateResume('u1', 'r1')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ targetCompany: 'Existing Co', targetRole: 'Existing Role' })
    )
  })
})
