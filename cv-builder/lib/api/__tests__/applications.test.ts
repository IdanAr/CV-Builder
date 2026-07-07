import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const {
  mockAppFind,
  mockAppFindOne,
  mockAppCreate,
  mockAppFindOneAndUpdate,
  mockAppDeleteOne,
  mockActivityFind,
  mockActivityInsertMany,
  mockActivityDeleteMany,
  mockResumeFind,
  mockResumeFindOne,
  mockGetOrCreateBoardConfig,
} = vi.hoisted(() => ({
  mockAppFind: vi.fn(),
  mockAppFindOne: vi.fn(),
  mockAppCreate: vi.fn(),
  mockAppFindOneAndUpdate: vi.fn(),
  mockAppDeleteOne: vi.fn(),
  mockActivityFind: vi.fn(),
  mockActivityInsertMany: vi.fn(),
  mockActivityDeleteMany: vi.fn(),
  mockResumeFind: vi.fn(),
  mockResumeFindOne: vi.fn(),
  mockGetOrCreateBoardConfig: vi.fn(),
}))

vi.mock('@/models/Application', () => ({
  default: {
    find: mockAppFind,
    findOne: mockAppFindOne,
    create: mockAppCreate,
    findOneAndUpdate: mockAppFindOneAndUpdate,
    deleteOne: mockAppDeleteOne,
  },
}))

vi.mock('@/models/ApplicationActivity', () => ({
  default: {
    find: mockActivityFind,
    insertMany: mockActivityInsertMany,
    deleteMany: mockActivityDeleteMany,
  },
}))

vi.mock('@/models/Resume', () => ({
  default: { find: mockResumeFind, findOne: mockResumeFindOne },
}))

vi.mock('@/lib/api/board-config', () => ({
  getOrCreateBoardConfig: mockGetOrCreateBoardConfig,
}))

import {
  listApplications,
  createApplication,
  patchApplication,
  deleteApplication,
  listActivity,
} from '../applications'
import { defaultBoardColumns } from '@/lib/schemas/application.zod'

function leanChain(resolved: unknown) {
  return { lean: vi.fn().mockResolvedValue(resolved) }
}

function sortLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => leanChain(resolved)) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetOrCreateBoardConfig.mockResolvedValue({
    userId: 'u1',
    columns: defaultBoardColumns(),
    sort: [],
  })
})

describe('listApplications', () => {
  it('resolves resumeTitle with a single batched Resume query (no N+1)', async () => {
    const apps = [
      { _id: 'a1', userId: 'u1', company: 'Acme', role: 'Eng', resumeId: 'r1', order: 1000 },
      { _id: 'a2', userId: 'u1', company: 'Globex', role: 'PM', resumeId: 'r2', order: 2000 },
      { _id: 'a3', userId: 'u1', company: 'Initech', role: 'Dev', order: 3000 },
    ]
    mockAppFind.mockReturnValue(sortLeanChain(apps))
    mockResumeFind.mockReturnValue(
      leanChain([
        { _id: 'r1', title: 'Backend CV' },
        { _id: 'r2', title: 'PM CV' },
      ])
    )

    const result = await listApplications('u1')

    expect(mockAppFind).toHaveBeenCalledWith({ userId: 'u1' })
    expect(mockResumeFind).toHaveBeenCalledTimes(1)
    expect(mockResumeFind).toHaveBeenCalledWith(
      { _id: { $in: ['r1', 'r2'] }, userId: 'u1' },
      'title'
    )
    expect(result[0].resumeTitle).toBe('Backend CV')
    expect(result[1].resumeTitle).toBe('PM CV')
    expect(result[2].resumeTitle).toBeUndefined()
  })

  it('skips the Resume query entirely when no application references a resume', async () => {
    mockAppFind.mockReturnValue(
      sortLeanChain([{ _id: 'a1', userId: 'u1', company: 'Acme', role: 'Eng', order: 1000 }])
    )

    const result = await listApplications('u1')

    expect(mockResumeFind).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })
})

describe('createApplication', () => {
  it('appends after the current max order (fractional-index convention)', async () => {
    mockAppFindOne.mockReturnValue(sortLeanChain({ _id: 'a9', order: 4000 }))
    mockAppCreate.mockResolvedValue({ toObject: () => ({ _id: 'new' }) })

    await createApplication('u1', { company: 'Acme', role: 'Eng', customFields: {} })

    expect(mockAppCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', company: 'Acme', order: 5000 })
    )
  })

  it('starts order at 1000 for the first application', async () => {
    mockAppFindOne.mockReturnValue(sortLeanChain(null))
    mockAppCreate.mockResolvedValue({ toObject: () => ({}) })

    await createApplication('u1', { company: 'Acme', role: 'Eng', customFields: {} })

    expect(mockAppCreate).toHaveBeenCalledWith(expect.objectContaining({ order: 1000 }))
  })

  it("defaults status to the first option of the user's status column", async () => {
    mockAppFindOne.mockReturnValue(sortLeanChain(null))
    mockAppCreate.mockResolvedValue({ toObject: () => ({}) })
    mockGetOrCreateBoardConfig.mockResolvedValue({
      userId: 'u1',
      columns: defaultBoardColumns().map((c) =>
        c.id === 'status'
          ? { ...c, options: [{ id: 'wishlist', label: 'Wishlist', color: '#888' }] }
          : c
      ),
      sort: [],
    })

    await createApplication('u1', { company: '', role: '', customFields: {} })

    expect(mockAppCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'wishlist' }))
  })

  it('prefills company/role from the referenced resume targetCompany/targetRole', async () => {
    mockAppFindOne.mockReturnValue(sortLeanChain(null))
    mockAppCreate.mockResolvedValue({ toObject: () => ({}) })
    mockResumeFindOne.mockReturnValue(
      leanChain({ _id: 'r1', title: 'CV', targetCompany: 'Acme', targetRole: 'Engineer' })
    )

    await createApplication('u1', { resumeId: 'r1', company: '', role: '', customFields: {} })

    expect(mockResumeFindOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
    expect(mockAppCreate).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId: 'r1', company: 'Acme', role: 'Engineer' })
    )
  })

  it('does not overwrite explicitly provided company/role with resume prefill', async () => {
    mockAppFindOne.mockReturnValue(sortLeanChain(null))
    mockAppCreate.mockResolvedValue({ toObject: () => ({}) })
    mockResumeFindOne.mockReturnValue(
      leanChain({ _id: 'r1', title: 'CV', targetCompany: 'Acme', targetRole: 'Engineer' })
    )

    await createApplication('u1', {
      resumeId: 'r1',
      company: 'Chosen Co',
      role: 'Chosen Role',
      customFields: {},
    })

    expect(mockAppCreate).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'Chosen Co', role: 'Chosen Role' })
    )
  })
})

describe('patchApplication (diff-and-log)', () => {
  const current = {
    _id: 'a1',
    userId: 'u1',
    company: 'Acme',
    role: 'Engineer',
    status: 'applied',
    order: 1000,
    customFields: { 'col-x': 'old note' },
  }

  beforeEach(() => {
    mockAppFindOne.mockReturnValue(leanChain(current))
    mockAppFindOneAndUpdate.mockReturnValue(leanChain({ ...current }))
    mockActivityInsertMany.mockResolvedValue([])
  })

  it('writes one activity row per actually-changed field', async () => {
    await patchApplication('u1', 'a1', { company: 'Globex', status: 'offer' })

    expect(mockActivityInsertMany).toHaveBeenCalledTimes(1)
    const rows = mockActivityInsertMany.mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          applicationId: 'a1',
          userId: 'u1',
          field: 'company',
          fieldLabel: 'Company',
          fromValue: 'Acme',
          toValue: 'Globex',
        }),
        expect.objectContaining({
          field: 'status',
          fieldLabel: 'Status',
          fromValue: 'Applied',
          toValue: 'Offer',
        }),
      ])
    )
    expect(rows.every((r: { changedAt: Date }) => r.changedAt instanceof Date)).toBe(true)
  })

  it('skips fields "changed" to the same value and writes no rows for a no-op patch', async () => {
    await patchApplication('u1', 'a1', { company: 'Acme', status: 'applied' })
    expect(mockActivityInsertMany).not.toHaveBeenCalled()
  })

  it('does not log order changes (drag reordering is not activity)', async () => {
    await patchApplication('u1', 'a1', { order: 1500 })

    expect(mockActivityInsertMany).not.toHaveBeenCalled()
    expect(mockAppFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a1', userId: 'u1' },
      { $set: { order: 1500 } },
      { new: true }
    )
  })

  it('merges customFields per key via dot notation and logs with the column label', async () => {
    mockGetOrCreateBoardConfig.mockResolvedValue({
      userId: 'u1',
      columns: [
        ...defaultBoardColumns(),
        {
          id: 'col-x',
          key: 'col-x',
          label: 'Recruiter Name',
          type: 'text',
          isBuiltIn: false,
          order: 6000,
        },
      ],
      sort: [],
    })

    await patchApplication('u1', 'a1', { customFields: { 'col-x': 'Dana' } })

    expect(mockAppFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a1', userId: 'u1' },
      { $set: { 'customFields.col-x': 'Dana' } },
      { new: true }
    )
    const rows = mockActivityInsertMany.mock.calls[0][0]
    expect(rows).toEqual([
      expect.objectContaining({
        field: 'col-x',
        fieldLabel: 'Recruiter Name',
        fromValue: 'old note',
        toValue: 'Dana',
      }),
    ])
  })

  it('records select-type custom field values as option labels, not option ids', async () => {
    mockGetOrCreateBoardConfig.mockResolvedValue({
      userId: 'u1',
      columns: [
        ...defaultBoardColumns(),
        {
          id: 'col-src',
          key: 'col-src',
          label: 'Source',
          type: 'select',
          isBuiltIn: false,
          order: 6000,
          options: [
            { id: 'opt-li', label: 'LinkedIn', color: '#0a66c2' },
            { id: 'opt-ref', label: 'Referral', color: '#22c55e' },
          ],
        },
      ],
      sort: [],
    })
    mockAppFindOne.mockReturnValue(
      leanChain({ ...current, customFields: { 'col-src': 'opt-li' } })
    )

    await patchApplication('u1', 'a1', { customFields: { 'col-src': 'opt-ref' } })

    const rows = mockActivityInsertMany.mock.calls[0][0]
    expect(rows[0].fromValue).toBe('LinkedIn')
    expect(rows[0].toValue).toBe('Referral')
  })

  it('resolves resumeId changes to resume titles in the log', async () => {
    mockResumeFind.mockReturnValue(
      leanChain([
        { _id: 'r1', title: 'Backend CV' },
        { _id: 'r2', title: 'Frontend CV' },
      ])
    )
    mockAppFindOne.mockReturnValue(leanChain({ ...current, resumeId: 'r1' }))

    await patchApplication('u1', 'a1', { resumeId: 'r2' })

    const rows = mockActivityInsertMany.mock.calls[0][0]
    expect(rows[0]).toEqual(
      expect.objectContaining({
        field: 'resumeId',
        fieldLabel: 'Resume',
        fromValue: 'Backend CV',
        toValue: 'Frontend CV',
      })
    )
  })

  it('logs a cleared field as null, not the string "null"', async () => {
    await patchApplication('u1', 'a1', { company: '' })

    const rows = mockActivityInsertMany.mock.calls[0][0]
    expect(rows[0].fromValue).toBe('Acme')
    expect(rows[0].toValue).toBeNull()
  })

  it('returns null and writes nothing when the application does not exist', async () => {
    mockAppFindOne.mockReturnValue(leanChain(null))

    const result = await patchApplication('u1', 'missing', { company: 'X' })

    expect(result).toBeNull()
    expect(mockAppFindOneAndUpdate).not.toHaveBeenCalled()
    expect(mockActivityInsertMany).not.toHaveBeenCalled()
  })
})

describe('deleteApplication', () => {
  it('deletes the row and cascades its activity log', async () => {
    mockAppDeleteOne.mockResolvedValue({ deletedCount: 1 })
    mockActivityDeleteMany.mockResolvedValue({ deletedCount: 3 })

    const result = await deleteApplication('u1', 'a1')

    expect(result).toBe(true)
    expect(mockAppDeleteOne).toHaveBeenCalledWith({ _id: 'a1', userId: 'u1' })
    expect(mockActivityDeleteMany).toHaveBeenCalledWith({ applicationId: 'a1', userId: 'u1' })
  })

  it('returns false and leaves activity alone when nothing was deleted', async () => {
    mockAppDeleteOne.mockResolvedValue({ deletedCount: 0 })

    const result = await deleteApplication('u1', 'a1')

    expect(result).toBe(false)
    expect(mockActivityDeleteMany).not.toHaveBeenCalled()
  })
})

describe('listActivity', () => {
  it('returns the log newest first, scoped to the owner', async () => {
    const sortMock = vi.fn(() => leanChain([{ _id: 'ev1' }]))
    mockActivityFind.mockReturnValue({ sort: sortMock })

    const result = await listActivity('u1', 'a1')

    expect(mockActivityFind).toHaveBeenCalledWith({ applicationId: 'a1', userId: 'u1' })
    expect(sortMock).toHaveBeenCalledWith({ changedAt: -1, _id: -1 })
    expect(result).toEqual([{ _id: 'ev1' }])
  })
})
