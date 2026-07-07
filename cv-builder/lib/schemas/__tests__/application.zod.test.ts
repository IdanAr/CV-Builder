import { describe, it, expect } from 'vitest'
import {
  BoardColumnSchema,
  ColumnOptionSchema,
  CreateApplicationSchema,
  PatchApplicationSchema,
  PatchBoardConfigSchema,
  CustomFieldValueSchema,
  defaultBoardColumns,
  DEFAULT_STATUS_OPTIONS,
  BUILT_IN_COLUMN_IDS,
} from '../application.zod'

describe('CustomFieldValueSchema', () => {
  it('accepts string, number, boolean, and null', () => {
    expect(CustomFieldValueSchema.safeParse('hello').success).toBe(true)
    expect(CustomFieldValueSchema.safeParse(42).success).toBe(true)
    expect(CustomFieldValueSchema.safeParse(true).success).toBe(true)
    expect(CustomFieldValueSchema.safeParse(null).success).toBe(true)
  })

  it('rejects objects and arrays', () => {
    expect(CustomFieldValueSchema.safeParse({ nested: 1 }).success).toBe(false)
    expect(CustomFieldValueSchema.safeParse([1, 2]).success).toBe(false)
  })
})

describe('BoardColumnSchema', () => {
  it('validates a select column with options', () => {
    const result = BoardColumnSchema.safeParse({
      id: 'col-1',
      key: 'col-1',
      label: 'Recruiter',
      type: 'select',
      isBuiltIn: false,
      order: 1000,
      options: [{ id: 'opt-1', label: 'Yes', color: '#22c55e' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown column type', () => {
    const result = BoardColumnSchema.safeParse({
      id: 'col-1',
      key: 'col-1',
      label: 'Bad',
      type: 'rating',
      isBuiltIn: false,
      order: 1000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty label', () => {
    const result = BoardColumnSchema.safeParse({
      id: 'col-1',
      key: 'col-1',
      label: '   ',
      type: 'text',
      isBuiltIn: false,
      order: 1000,
    })
    expect(result.success).toBe(false)
  })
})

describe('ColumnOptionSchema', () => {
  it('requires id, label, and color', () => {
    expect(ColumnOptionSchema.safeParse({ id: 'a', label: 'A', color: '#fff' }).success).toBe(true)
    expect(ColumnOptionSchema.safeParse({ id: 'a', label: 'A' }).success).toBe(false)
  })
})

describe('CreateApplicationSchema', () => {
  it('defaults customFields to an empty object and accepts minimal input', () => {
    const result = CreateApplicationSchema.parse({ company: 'Acme', role: 'Engineer' })
    expect(result.customFields).toEqual({})
    expect(result.company).toBe('Acme')
  })

  it('allows empty company/role so a blank quick-add row can be created', () => {
    const result = CreateApplicationSchema.parse({})
    expect(result.company).toBe('')
    expect(result.role).toBe('')
  })

  it('accepts an optional resumeId and status', () => {
    const result = CreateApplicationSchema.parse({ resumeId: 'r1', status: 'applied' })
    expect(result.resumeId).toBe('r1')
    expect(result.status).toBe('applied')
  })
})

describe('PatchApplicationSchema', () => {
  it('accepts a partial patch with customFields', () => {
    const result = PatchApplicationSchema.safeParse({
      status: 'offer',
      customFields: { 'col-1': 'note', 'col-2': 5, 'col-3': null },
    })
    expect(result.success).toBe(true)
  })

  it('rejects nested objects inside customFields', () => {
    const result = PatchApplicationSchema.safeParse({ customFields: { 'col-1': { deep: 1 } } })
    expect(result.success).toBe(false)
  })

  it('allows resumeId to be set to null (unlink resume)', () => {
    const result = PatchApplicationSchema.safeParse({ resumeId: null })
    expect(result.success).toBe(true)
  })
})

describe('PatchBoardConfigSchema', () => {
  it('accepts a columns-only patch and a sort-only patch', () => {
    expect(
      PatchBoardConfigSchema.safeParse({
        columns: defaultBoardColumns(),
      }).success
    ).toBe(true)
    expect(
      PatchBoardConfigSchema.safeParse({
        sort: [{ columnId: 'company', direction: 'asc' }],
      }).success
    ).toBe(true)
  })

  it('rejects an invalid sort direction', () => {
    expect(
      PatchBoardConfigSchema.safeParse({ sort: [{ columnId: 'company', direction: 'up' }] }).success
    ).toBe(false)
  })
})

describe('defaultBoardColumns', () => {
  it('contains the five built-in columns in order: company, role, status, resumeId, createdAt', () => {
    const cols = defaultBoardColumns()
    expect(cols.map((c) => c.key)).toEqual(['company', 'role', 'status', 'resumeId', 'createdAt'])
    expect(cols.every((c) => c.isBuiltIn)).toBe(true)
  })

  it('seeds the status column with the four default options, each with a color', () => {
    const status = defaultBoardColumns().find((c) => c.key === 'status')
    expect(status?.type).toBe('status')
    expect(status?.options?.map((o) => o.label)).toEqual([
      'Applied',
      'Interviewing',
      'Offer',
      'Rejected',
    ])
    expect(status?.options?.every((o) => o.color.startsWith('#'))).toBe(true)
  })

  it('every column passes BoardColumnSchema validation', () => {
    for (const col of defaultBoardColumns()) {
      expect(BoardColumnSchema.safeParse(col).success).toBe(true)
    }
  })

  it('exports BUILT_IN_COLUMN_IDS matching the default column ids', () => {
    expect([...BUILT_IN_COLUMN_IDS]).toEqual(defaultBoardColumns().map((c) => c.id))
  })

  it('default status options use stable ids', () => {
    expect(DEFAULT_STATUS_OPTIONS.map((o) => o.id)).toEqual([
      'applied',
      'interviewing',
      'offer',
      'rejected',
    ])
  })
})
