// lib/applications/filter.ts
// Client-side filtering for the applications supertable. Filters are a
// display preference (persisted in localStorage, not BoardConfig) and apply
// identically to the Table and Kanban views. Multiple filters AND together.
import type { BoardColumn } from '@/lib/schemas/application.zod'
import { getCellValue } from './cells'
import type { ApplicationRow } from './types'

export type FilterKind = 'options' | 'text' | 'range' | 'dateRange' | 'checkbox'

export type ColumnFilter =
  | { columnId: string; kind: 'options'; optionIds: string[] }
  | { columnId: string; kind: 'text'; query: string }
  | { columnId: string; kind: 'range'; min?: number; max?: number }
  | { columnId: string; kind: 'dateRange'; from?: string; to?: string }
  | { columnId: string; kind: 'checkbox'; value: boolean }

/** Which filter editor a column gets, by its type. */
export function filterTypeForColumn(column: BoardColumn): FilterKind {
  switch (column.type) {
    case 'select':
    case 'status':
      return 'options'
    case 'number':
      return 'range'
    case 'date':
      return 'dateRange'
    case 'checkbox':
      return 'checkbox'
    default:
      return 'text'
  }
}

function matches(app: ApplicationRow, filter: ColumnFilter, column: BoardColumn): boolean {
  const raw = getCellValue(app, column)
  switch (filter.kind) {
    case 'options':
      if (filter.optionIds.length === 0) return true
      return filter.optionIds.includes(String(raw))
    case 'text': {
      const query = filter.query.trim().toLowerCase()
      if (query === '') return true
      // The resume column stores an id; users think in titles.
      const haystack =
        column.key === 'resumeId' ? app.resumeTitle ?? '' : String(raw ?? '')
      return haystack.toLowerCase().includes(query)
    }
    case 'range': {
      if (raw === null || raw === undefined || raw === '') return false
      const n = Number(raw)
      if (!Number.isFinite(n)) return false
      if (filter.min !== undefined && n < filter.min) return false
      if (filter.max !== undefined && n > filter.max) return false
      return true
    }
    case 'dateRange': {
      if (typeof raw !== 'string' || raw === '') return false
      const t = new Date(raw).getTime()
      if (Number.isNaN(t)) return false
      if (filter.from && t < new Date(filter.from).getTime()) return false
      // 'to' is inclusive of the whole day.
      if (filter.to && t > new Date(filter.to).getTime() + 86_399_999) return false
      return true
    }
    case 'checkbox':
      return (raw === true) === filter.value
  }
}

export function applyFilters(
  applications: ApplicationRow[],
  filters: ColumnFilter[],
  columns: BoardColumn[]
): ApplicationRow[] {
  if (filters.length === 0) return applications
  const columnById = new Map(columns.map((c) => [c.id, c]))
  const active = filters
    .map((filter) => ({ filter, column: columnById.get(filter.columnId) }))
    .filter((x): x is { filter: ColumnFilter; column: BoardColumn } => x.column !== undefined)
  if (active.length === 0) return applications
  return applications.filter((app) => active.every(({ filter, column }) => matches(app, filter, column)))
}

/** Human-readable chip label for an active filter. */
export function describeFilter(filter: ColumnFilter, column: BoardColumn): string {
  switch (filter.kind) {
    case 'options': {
      const labels = filter.optionIds.map(
        (id) => column.options?.find((o) => o.id === id)?.label ?? id
      )
      return `${column.label}: ${labels.join(', ')}`
    }
    case 'text':
      return `${column.label} contains "${filter.query}"`
    case 'range':
      if (filter.min !== undefined && filter.max !== undefined) {
        return `${column.label}: ${filter.min}–${filter.max}`
      }
      if (filter.min !== undefined) return `${column.label}: ≥ ${filter.min}`
      if (filter.max !== undefined) return `${column.label}: ≤ ${filter.max}`
      return column.label
    case 'dateRange':
      if (filter.from && filter.to) return `${column.label}: ${filter.from} – ${filter.to}`
      if (filter.from) return `${column.label}: from ${filter.from}`
      if (filter.to) return `${column.label}: until ${filter.to}`
      return column.label
    case 'checkbox':
      return `${column.label}: ${filter.value ? 'checked' : 'unchecked'}`
  }
}
