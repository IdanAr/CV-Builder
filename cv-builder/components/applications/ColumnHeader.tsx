'use client'

// Column header content: click-to-sort with multi-level indicators.
// Plain click cycles asc → desc → off; shift-click adds/cycles a secondary
// sort level. A numbered badge shows each column's position in a multi-sort.
import type { BoardColumn, SortEntry } from '@/lib/schemas/application.zod'

const LEVEL_BADGES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

export function ColumnHeader({
  column,
  sort,
  onToggleSort,
}: {
  column: BoardColumn
  sort: SortEntry[]
  onToggleSort: (columnId: string, additive: boolean) => void
}) {
  const level = sort.findIndex((s) => s.columnId === column.id)
  const entry = level === -1 ? undefined : sort[level]

  return (
    <button
      type="button"
      onClick={(e) => onToggleSort(column.id, e.shiftKey)}
      aria-label={`Sort by ${column.label}${
        entry ? ` (currently ${entry.direction === 'asc' ? 'ascending' : 'descending'})` : ''
      }`}
      title="Click to sort · Shift-click to add a sort level"
      className="flex w-full min-w-0 items-center gap-1 rounded px-0.5 text-left text-xs font-semibold uppercase tracking-wide text-indigo-500 hover:text-indigo-700"
    >
      <span className="truncate">{column.label}</span>
      {entry && (
        <span className="shrink-0 text-indigo-600" aria-hidden="true">
          {entry.direction === 'asc' ? '▲' : '▼'}
          {sort.length > 1 && (
            <span className="ml-0.5 text-[10px]">{LEVEL_BADGES[level] ?? level + 1}</span>
          )}
        </span>
      )}
    </button>
  )
}
