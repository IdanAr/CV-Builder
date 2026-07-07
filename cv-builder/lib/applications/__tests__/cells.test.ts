import { describe, it, expect } from 'vitest'
import { getCellValue, buildCellPatch, isColumnEditable } from '../cells'
import { defaultBoardColumns, type BoardColumn } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '../types'

const app: ApplicationRow = {
  _id: 'a1',
  resumeId: 'r1',
  company: 'Acme',
  role: 'Engineer',
  status: 'applied',
  order: 1000,
  customFields: { 'col-x': 42, 'col-y': false },
  resumeTitle: 'Backend CV',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-02T10:00:00.000Z',
}

const cols = new Map(defaultBoardColumns().map((c) => [c.id, c]))
const customCol: BoardColumn = {
  id: 'col-x',
  key: 'col-x',
  label: 'Salary',
  type: 'number',
  isBuiltIn: false,
  order: 6000,
}

describe('getCellValue', () => {
  it('reads built-in fields from the document root', () => {
    expect(getCellValue(app, cols.get('company')!)).toBe('Acme')
    expect(getCellValue(app, cols.get('status')!)).toBe('applied')
    expect(getCellValue(app, cols.get('resumeId')!)).toBe('r1')
    expect(getCellValue(app, cols.get('createdAt')!)).toBe('2026-07-01T10:00:00.000Z')
  })

  it('reads custom fields from customFields by column id', () => {
    expect(getCellValue(app, customCol)).toBe(42)
  })

  it('returns null for an unset custom field', () => {
    expect(getCellValue(app, { ...customCol, id: 'col-missing' })).toBeNull()
  })
})

describe('buildCellPatch', () => {
  it('patches built-in fields at the document root', () => {
    expect(buildCellPatch(cols.get('company')!, 'Globex')).toEqual({ company: 'Globex' })
    expect(buildCellPatch(cols.get('status')!, 'offer')).toEqual({ status: 'offer' })
    expect(buildCellPatch(cols.get('resumeId')!, null)).toEqual({ resumeId: null })
  })

  it('patches custom fields under customFields keyed by column id', () => {
    expect(buildCellPatch(customCol, 55000)).toEqual({ customFields: { 'col-x': 55000 } })
  })

  it('returns null for the read-only createdAt column', () => {
    expect(buildCellPatch(cols.get('createdAt')!, '2026-01-01')).toBeNull()
  })
})

describe('isColumnEditable', () => {
  it('marks createdAt read-only and everything else editable', () => {
    expect(isColumnEditable(cols.get('createdAt')!)).toBe(false)
    expect(isColumnEditable(cols.get('company')!)).toBe(true)
    expect(isColumnEditable(customCol)).toBe(true)
  })
})
