import { describe, it, expect } from 'vitest'
import { sortApplications, toggleSort } from '../sort'
import { defaultBoardColumns, type BoardColumn, type SortEntry } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '../types'

const columns = defaultBoardColumns()

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

describe('sortApplications', () => {
  it('falls back to manual order when the sort spec is empty', () => {
    const apps = [
      app({ _id: 'b', order: 2000 }),
      app({ _id: 'a', order: 1000 }),
      app({ _id: 'c', order: 1500 }),
    ]
    expect(sortApplications(apps, [], columns).map((a) => a._id)).toEqual(['a', 'c', 'b'])
  })

  it('sorts text columns case-insensitively', () => {
    const apps = [
      app({ _id: '1', company: 'zeta' }),
      app({ _id: '2', company: 'Acme' }),
      app({ _id: '3', company: 'beta' }),
    ]
    const sorted = sortApplications(apps, [{ columnId: 'company', direction: 'asc' }], columns)
    expect(sorted.map((a) => a.company)).toEqual(['Acme', 'beta', 'zeta'])
  })

  it('reverses for desc', () => {
    const apps = [app({ _id: '1', company: 'Acme' }), app({ _id: '2', company: 'Beta' })]
    const sorted = sortApplications(apps, [{ columnId: 'company', direction: 'desc' }], columns)
    expect(sorted.map((a) => a.company)).toEqual(['Beta', 'Acme'])
  })

  it('applies later entries as tiebreakers within earlier ones (multi-column)', () => {
    const apps = [
      app({ _id: '1', company: 'Acme', role: 'Senior' }),
      app({ _id: '2', company: 'Beta', role: 'Any' }),
      app({ _id: '3', company: 'Acme', role: 'Junior' }),
    ]
    const sorted = sortApplications(
      apps,
      [
        { columnId: 'company', direction: 'asc' },
        { columnId: 'role', direction: 'asc' },
      ],
      columns
    )
    expect(sorted.map((a) => a._id)).toEqual(['3', '1', '2'])
  })

  it('sorts status columns by option position (pipeline order), not alphabetically', () => {
    // Alphabetical would put Interviewing < Offer < Rejected ... but Applied
    // comes first in the pipeline and Rejected last.
    const apps = [
      app({ _id: '1', status: 'rejected' }),
      app({ _id: '2', status: 'applied' }),
      app({ _id: '3', status: 'offer' }),
    ]
    const sorted = sortApplications(apps, [{ columnId: 'status', direction: 'asc' }], columns)
    expect(sorted.map((a) => a.status)).toEqual(['applied', 'offer', 'rejected'])
  })

  it('sorts number custom columns numerically and puts empty values last', () => {
    const numberCol: BoardColumn = {
      id: 'col-n',
      key: 'col-n',
      label: 'Salary',
      type: 'number',
      isBuiltIn: false,
      order: 6000,
    }
    const apps = [
      app({ _id: '1', customFields: { 'col-n': 90 } }),
      app({ _id: '2', customFields: {} }),
      app({ _id: '3', customFields: { 'col-n': 10 } }),
    ]
    const asc = sortApplications(apps, [{ columnId: 'col-n', direction: 'asc' }], [...columns, numberCol])
    expect(asc.map((a) => a._id)).toEqual(['3', '1', '2'])
    const desc = sortApplications(apps, [{ columnId: 'col-n', direction: 'desc' }], [...columns, numberCol])
    expect(desc.map((a) => a._id)).toEqual(['1', '3', '2'])
  })

  it('sorts the createdAt date column chronologically', () => {
    const apps = [
      app({ _id: '1', createdAt: '2026-07-03T00:00:00.000Z' }),
      app({ _id: '2', createdAt: '2026-07-01T00:00:00.000Z' }),
    ]
    const sorted = sortApplications(apps, [{ columnId: 'createdAt', direction: 'asc' }], columns)
    expect(sorted.map((a) => a._id)).toEqual(['2', '1'])
  })

  it('does not mutate the input array', () => {
    const apps = [app({ _id: 'b', company: 'B' }), app({ _id: 'a', company: 'A' })]
    sortApplications(apps, [{ columnId: 'company', direction: 'asc' }], columns)
    expect(apps.map((a) => a._id)).toEqual(['b', 'a'])
  })
})

describe('toggleSort', () => {
  it('cycles a plain click: off -> asc -> desc -> off, replacing other entries', () => {
    let sort: SortEntry[] = []
    sort = toggleSort(sort, 'company', false)
    expect(sort).toEqual([{ columnId: 'company', direction: 'asc' }])
    sort = toggleSort(sort, 'company', false)
    expect(sort).toEqual([{ columnId: 'company', direction: 'desc' }])
    sort = toggleSort(sort, 'company', false)
    expect(sort).toEqual([])
  })

  it('a plain click on a different column replaces the whole spec', () => {
    const sort: SortEntry[] = [
      { columnId: 'company', direction: 'asc' },
      { columnId: 'role', direction: 'desc' },
    ]
    expect(toggleSort(sort, 'status', false)).toEqual([{ columnId: 'status', direction: 'asc' }])
  })

  it('an additive (shift) click appends a secondary level', () => {
    const sort: SortEntry[] = [{ columnId: 'company', direction: 'asc' }]
    expect(toggleSort(sort, 'role', true)).toEqual([
      { columnId: 'company', direction: 'asc' },
      { columnId: 'role', direction: 'asc' },
    ])
  })

  it('an additive click on an already-sorted column cycles its direction in place', () => {
    const sort: SortEntry[] = [
      { columnId: 'company', direction: 'asc' },
      { columnId: 'role', direction: 'asc' },
    ]
    expect(toggleSort(sort, 'company', true)).toEqual([
      { columnId: 'company', direction: 'desc' },
      { columnId: 'role', direction: 'asc' },
    ])
    expect(toggleSort(toggleSort(sort, 'company', true), 'company', true)).toEqual([
      { columnId: 'role', direction: 'asc' },
    ])
  })
})
