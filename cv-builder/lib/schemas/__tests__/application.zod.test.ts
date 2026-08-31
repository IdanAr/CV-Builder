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

  it('never lets a __proto__ key survive into parsed customFields (prototype-pollution guard)', () => {
    // A JS object literal's `__proto__` key sets the prototype rather than
    // becoming an own enumerable key, so it wouldn't reach Object.keys() here
    // — JSON.parse (what a real request body goes through) is what actually
    // produces an attacker-controlled *own* `__proto__` key on the input.
    // Zod's z.record() itself already drops that key while building its
    // output object (the same own-vs-prototype-setter distinction applies to
    // its internal assignment), so the safe, verifiable outcome is that the
    // parsed customFields never carries an own `__proto__` key — not
    // necessarily that parsing fails outright.
    const body = JSON.parse('{"customFields": {"__proto__": "x", "safe-key": "y"}}')
    const result = CreateApplicationSchema.safeParse(body)
    expect(result.success).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(result.data!.customFields, '__proto__')).toBe(false)
    expect(result.data!.customFields['safe-key']).toBe('y')
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

  it('never lets a __proto__ key survive into parsed customFields (prototype-pollution guard)', () => {
    // See the matching CreateApplicationSchema test above for why this
    // asserts the key is stripped rather than that parsing fails.
    const body = JSON.parse('{"customFields": {"__proto__": "x", "safe-key": "y"}}')
    const result = PatchApplicationSchema.safeParse(body)
    expect(result.success).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(result.data!.customFields, '__proto__')).toBe(false)
    expect(result.data!.customFields!['safe-key']).toBe('y')
  })

  it('rejects constructor/prototype keys in customFields', () => {
    expect(PatchApplicationSchema.safeParse({ customFields: { constructor: 'x' } }).success).toBe(false)
    expect(PatchApplicationSchema.safeParse({ customFields: { prototype: 'x' } }).success).toBe(false)
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
