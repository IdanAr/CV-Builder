// lib/applications/sort.ts
// Client-side multi-column sorting for the applications supertable. The sort
// spec is an ordered list: the first entry is primary, each later entry only
// breaks ties within the previous ones.
import type { BoardColumn, SortEntry } from '@/lib/schemas/application.zod'
import { getCellValue } from './cells'
import type { ApplicationRow } from './types'

/**
 * Column-type-aware comparison of two cell values.
 * Empty values (null/undefined/'') always sort last, in both directions.
 */
function compareValues(a: unknown, b: unknown, column: BoardColumn): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  switch (column.type) {
    case 'number':
      return Number(a) - Number(b)
    case 'checkbox':
      return Number(a === true) - Number(b === true)
    case 'date': {
      const at = new Date(String(a)).getTime()
      const bt = new Date(String(b)).getTime()
      if (Number.isNaN(at) || Number.isNaN(bt)) return String(a).localeCompare(String(b))
      return at - bt
    }
    case 'select':
    case 'status': {
      // Sort by option position (pipeline order), not label alphabetics —
      // "Applied → Interviewing → Offer" is the meaningful ordering.
      const options = column.options ?? []
      const ai = options.findIndex((o) => o.id === a)
      const bi = options.findIndex((o) => o.id === b)
      if (ai === -1 || bi === -1) return String(a).localeCompare(String(b))
      return ai - bi
    }
    default:
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
  }
}

/**
 * Returns a new sorted array. An empty sort spec falls back to the manual
 * (drag-and-drop) `order` field — never sorts in place.
 */
export function sortApplications(
  applications: ApplicationRow[],
  sort: SortEntry[],
  columns: BoardColumn[]
): ApplicationRow[] {
  const columnById = new Map(columns.map((c) => [c.id, c]))
  const entries = sort
    .map((entry) => ({ entry, column: columnById.get(entry.columnId) }))
    .filter((x): x is { entry: SortEntry; column: BoardColumn } => x.column !== undefined)

  const sorted = [...applications]
  if (entries.length === 0) {
    return sorted.sort((a, b) => a.order - b.order)
  }
  return sorted.sort((a, b) => {
    for (const { entry, column } of entries) {
      // Empty-last is deliberately not flipped by direction: getCellValue's
      // comparison handles it before the direction multiplier applies.
      const av = getCellValue(a, column)
      const bv = getCellValue(b, column)
      const aEmpty = av === null || av === undefined || av === ''
      const bEmpty = bv === null || bv === undefined || bv === ''
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
      const cmp = compareValues(av, bv, column)
      if (cmp !== 0) return entry.direction === 'desc' ? -cmp : cmp
    }
    // Stable final tiebreaker: manual order.
    return a.order - b.order
  })
}

/**
 * Header-click behavior. Plain click cycles this column asc → desc → off,
 * replacing any other sort levels. Additive (shift) click keeps existing
 * levels: appends this column as the next level, or cycles it in place if
 * already part of the spec.
 */
export function toggleSort(sort: SortEntry[], columnId: string, additive: boolean): SortEntry[] {
  const existing = sort.find((s) => s.columnId === columnId)

  if (!additive) {
    if (!existing) return [{ columnId, direction: 'asc' }]
    if (existing.direction === 'asc') return [{ columnId, direction: 'desc' }]
    return []
  }

  if (!existing) return [...sort, { columnId, direction: 'asc' }]
  if (existing.direction === 'asc') {
    return sort.map((s) => (s.columnId === columnId ? { ...s, direction: 'desc' as const } : s))
  }
  return sort.filter((s) => s.columnId !== columnId)
}
