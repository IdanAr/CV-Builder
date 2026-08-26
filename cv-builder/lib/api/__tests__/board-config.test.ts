import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const { mockFindOne, mockCreate, mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockCreate: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
}))

vi.mock('@/models/BoardConfig', () => ({
  default: {
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}))

import {
  getOrCreateBoardConfig,
  patchBoardConfig,
  ensureJobMetadataColumns,
  JOB_URL_COLUMN_ID,
  JOB_LOCATION_COLUMN_ID,
} from '../board-config'
import { defaultBoardColumns } from '@/lib/schemas/application.zod'

beforeEach(() => vi.clearAllMocks())

describe('getOrCreateBoardConfig', () => {
  it('returns the existing config without creating one', async () => {
    const existing = { _id: 'b1', userId: 'u1', columns: [], sort: [] }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(existing) })

    const result = await getOrCreateBoardConfig('u1')

    expect(mockFindOne).toHaveBeenCalledWith({ userId: 'u1' })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(result).toEqual(existing)
  })

  it('auto-creates the default config on first call', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const created = { userId: 'u1', columns: defaultBoardColumns(), sort: [] }
    mockCreate.mockResolvedValue({ toObject: () => created })

    const result = await getOrCreateBoardConfig('u1')

    expect(mockCreate).toHaveBeenCalledWith({
      userId: 'u1',
      columns: defaultBoardColumns(),
      sort: [],
    })
    expect(result).toEqual(created)
  })
})

describe('patchBoardConfig', () => {
  it('updates the sort spec only, leaving columns untouched', async () => {
    const updated = { userId: 'u1', columns: defaultBoardColumns(), sort: [] }
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(updated) })

    await patchBoardConfig('u1', { sort: [{ columnId: 'company', direction: 'asc' }] })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { sort: [{ columnId: 'company', direction: 'asc' }] } },
      { new: true }
    )
  })

  it('rejects a columns patch that removes a built-in column', async () => {
    const columns = defaultBoardColumns().filter((c) => c.id !== 'status')
    await expect(patchBoardConfig('u1', { columns })).rejects.toThrow(/built-in/i)
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects a columns patch with duplicate column ids', async () => {
    const columns = [...defaultBoardColumns(), { ...defaultBoardColumns()[0] }]
    await expect(patchBoardConfig('u1', { columns })).rejects.toThrow(/duplicate/i)
  })

  it('accepts a columns patch that adds a custom column and reorders', async () => {
    const columns = [
      ...defaultBoardColumns(),
      {
        id: 'col-abc',
        key: 'col-abc',
        label: 'Recruiter',
        type: 'text' as const,
        isBuiltIn: false,
        order: 6000,
      },
    ]
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) })

    await patchBoardConfig('u1', { columns })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { columns } },
      { new: true }
    )
  })

  it('rejects a select/status column without at least one option', async () => {
    const columns = defaultBoardColumns().map((c) =>
      c.id === 'status' ? { ...c, options: [] } : c
    )
    await expect(patchBoardConfig('u1', { columns })).rejects.toThrow(/option/i)
  })

  it('rejects removing the last status-type column so the Kanban view always has a grouping column', async () => {
    const columns = defaultBoardColumns().map((c) =>
      c.id === 'status' ? { ...c, type: 'text' as const, options: undefined } : c
    )
    await expect(patchBoardConfig('u1', { columns })).rejects.toThrow(/status/i)
  })
})

describe('ensureJobMetadataColumns', () => {
  it('appends both columns when neither already exists', async () => {
    const existing = { userId: 'u1', columns: defaultBoardColumns(), sort: [] }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(existing) })
    mockFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) })

    await ensureJobMetadataColumns('u1')

    const patchedColumns = mockFindOneAndUpdate.mock.calls[0][1].$set.columns
    const ids = patchedColumns.map((c: { id: string }) => c.id)
    expect(ids).toContain(JOB_URL_COLUMN_ID)
    expect(ids).toContain(JOB_LOCATION_COLUMN_ID)
    expect(patchedColumns).toHaveLength(defaultBoardColumns().length + 2)
  })

  it('is a no-op when both columns already exist', async () => {
    const existing = {
      userId: 'u1',
      columns: [
        ...defaultBoardColumns(),
        { id: JOB_URL_COLUMN_ID, key: JOB_URL_COLUMN_ID, label: 'Job URL', type: 'url' as const, isBuiltIn: false, order: 6000 },
        { id: JOB_LOCATION_COLUMN_ID, key: JOB_LOCATION_COLUMN_ID, label: 'Location', type: 'text' as const, isBuiltIn: false, order: 7000 },
      ],
      sort: [],
    }
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(existing) })

    await ensureJobMetadataColumns('u1')

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
  })
})
