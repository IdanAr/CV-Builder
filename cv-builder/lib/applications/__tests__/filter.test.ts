import { describe, it, expect } from 'vitest'
import { applyFilters, describeFilter, filterTypeForColumn, type ColumnFilter } from '../filter'
import { defaultBoardColumns, type BoardColumn } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '../types'

const columns: BoardColumn[] = [
  ...defaultBoardColumns(),
  { id: 'col-sal', key: 'col-sal', label: 'Salary', type: 'number', isBuiltIn: false, order: 6000 },
  { id: 'col-rem', key: 'col-rem', label: 'Remote', type: 'checkbox', isBuiltIn: false, order: 7000 },
  { id: 'col-when', key: 'col-when', label: 'Interview', type: 'date', isBuiltIn: false, order: 8000 },
]

function app(partial: Partial<ApplicationRow> & { _id: string }): ApplicationRow {
  return {
    company: '',
    role: '',
    status: 'applied',
    order: 1000,
    customFields: {},
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

const apps = [
  app({ _id: '1', company: 'Acme Corp', status: 'applied', resumeTitle: 'Backend CV', resumeId: 'r1', customFields: { 'col-sal': 90, 'col-rem': true, 'col-when': '2026-07-10' } }),
  app({ _id: '2', company: 'Globex', status: 'interviewing', customFields: { 'col-sal': 120, 'col-rem': false, 'col-when': '2026-07-20' } }),
  app({ _id: '3', company: 'Initech', status: 'offer', customFields: {} }),
]

describe('applyFilters', () => {
  it('returns everything for an empty filter set', () => {
    expect(applyFilters(apps, [], columns)).toHaveLength(3)
  })

  it('filters select/status columns by a multi-select of option ids', () => {
    const filters: ColumnFilter[] = [
      { columnId: 'status', kind: 'options', optionIds: ['interviewing', 'offer'] },
    ]
    expect(applyFilters(apps, filters, columns).map((a) => a._id)).toEqual(['2', '3'])
  })

  it('filters text columns by case-insensitive contains', () => {
    const filters: ColumnFilter[] = [{ columnId: 'company', kind: 'text', query: 'acme' }]
    expect(applyFilters(apps, filters, columns).map((a) => a._id)).toEqual(['1'])
  })

  it('matches the resume column against the resume title, not the id', () => {
    const filters: ColumnFilter[] = [{ columnId: 'resumeId', kind: 'text', query: 'backend' }]
    expect(applyFilters(apps, filters, columns).map((a) => a._id)).toEqual(['1'])
  })

  it('filters number columns by min/max range (either bound optional)', () => {
    expect(
      applyFilters(apps, [{ columnId: 'col-sal', kind: 'range', min: 100 }], columns).map((a) => a._id)
    ).toEqual(['2'])
    expect(
      applyFilters(apps, [{ columnId: 'col-sal', kind: 'range', max: 100 }], columns).map((a) => a._id)
    ).toEqual(['1'])
  })

  it('filters date columns by from/to range', () => {
    const filters: ColumnFilter[] = [
      { columnId: 'col-when', kind: 'dateRange', from: '2026-07-15' },
    ]
    expect(applyFilters(apps, filters, columns).map((a) => a._id)).toEqual(['2'])
  })

  it('filters checkbox columns by on/off', () => {
    expect(
      applyFilters(apps, [{ columnId: 'col-rem', kind: 'checkbox', value: true }], columns).map((a) => a._id)
    ).toEqual(['1'])
    // Unset values count as unchecked.
    expect(
      applyFilters(apps, [{ columnId: 'col-rem', kind: 'checkbox', value: false }], columns).map((a) => a._id)
    ).toEqual(['2', '3'])
  })

  it('ANDs multiple filters together', () => {
    const filters: ColumnFilter[] = [
      { columnId: 'status', kind: 'options', optionIds: ['applied', 'interviewing'] },
      { columnId: 'col-sal', kind: 'range', min: 100 },
    ]
    expect(applyFilters(apps, filters, columns).map((a) => a._id)).toEqual(['2'])
  })

  it('ignores filters whose column no longer exists', () => {
    const filters: ColumnFilter[] = [{ columnId: 'col-gone', kind: 'text', query: 'x' }]
    expect(applyFilters(apps, filters, columns)).toHaveLength(3)
  })
})

describe('describeFilter', () => {
  const byId = new Map(columns.map((c) => [c.id, c]))

  it('describes an options filter with option labels', () => {
    expect(
      describeFilter({ columnId: 'status', kind: 'options', optionIds: ['applied', 'offer'] }, byId.get('status')!)
    ).toBe('Status: Applied, Offer')
  })

  it('describes text, range, date, and checkbox filters', () => {
    expect(describeFilter({ columnId: 'company', kind: 'text', query: 'acme' }, byId.get('company')!)).toBe(
      'Company contains "acme"'
    )
    expect(
      describeFilter({ columnId: 'col-sal', kind: 'range', min: 100, max: 200 }, byId.get('col-sal')!)
    ).toBe('Salary: 100–200')
    expect(describeFilter({ columnId: 'col-sal', kind: 'range', min: 100 }, byId.get('col-sal')!)).toBe(
      'Salary: ≥ 100'
    )
    expect(
      describeFilter({ columnId: 'col-when', kind: 'dateRange', from: '2026-07-01' }, byId.get('col-when')!)
    ).toBe('Interview: from 2026-07-01')
    expect(
      describeFilter({ columnId: 'col-rem', kind: 'checkbox', value: true }, byId.get('col-rem')!)
    ).toBe('Remote: checked')
  })
})

describe('filterTypeForColumn', () => {
  it('maps column types to filter kinds', () => {
    const byId = new Map(columns.map((c) => [c.id, c]))
    expect(filterTypeForColumn(byId.get('status')!)).toBe('options')
    expect(filterTypeForColumn(byId.get('company')!)).toBe('text')
    expect(filterTypeForColumn(byId.get('col-sal')!)).toBe('range')
    expect(filterTypeForColumn(byId.get('col-when')!)).toBe('dateRange')
    expect(filterTypeForColumn(byId.get('col-rem')!)).toBe('checkbox')
    expect(filterTypeForColumn(byId.get('createdAt')!)).toBe('dateRange')
  })
})
