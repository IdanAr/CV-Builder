'use client'

// Column header content: click-to-sort with multi-level indicators.
// Plain click cycles asc → desc → off; shift-click adds/cycles a secondary
// sort level. A numbered badge shows each column's position in a multi-sort.
import { Pencil, X } from 'lucide-react'
import type { BoardColumn, SortEntry } from '@/lib/schemas/application.zod'

const LEVEL_BADGES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

export function ColumnHeader({
  column,
  sort,
  onToggleSort,
  onEdit,
  onDelete,
}: {
  column: BoardColumn
  sort: SortEntry[]
  onToggleSort: (columnId: string, additive: boolean) => void
  /** Opens the column editor (rename; option editing for select/status). */
  onEdit?: (column: BoardColumn) => void
  /** Only offered for custom columns — built-ins can't be deleted. */
  onDelete?: (column: BoardColumn) => void
}) {
  const level = sort.findIndex((s) => s.columnId === column.id)
  const entry = level === -1 ? undefined : sort[level]

  return (
    <span className="group/header flex w-full min-w-0 items-center gap-0.5">
      <button
        type="button"
        onClick={(e) => onToggleSort(column.id, e.shiftKey)}
        aria-label={`Sort by ${column.label}${
          entry ? ` (currently ${entry.direction === 'asc' ? 'ascending' : 'descending'})` : ''
        }`}
        title="Click to sort · Shift-click to add a sort level"
        className="flex min-w-0 flex-1 items-center gap-1 rounded px-0.5 text-left text-xs font-semibold uppercase tracking-wide text-indigo-500 hover:text-indigo-700"
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
      {onEdit && (
        <button
          type="button"
          aria-label={`Edit ${column.label} column`}
          title="Edit column"
          onClick={() => onEdit(column)}
          className="shrink-0 rounded px-0.5 text-[11px] text-indigo-300 opacity-0 transition group-hover/header:opacity-100 hover:text-indigo-600 focus:opacity-100"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
      {onDelete && !column.isBuiltIn && (
        <button
          type="button"
          aria-label={`Delete ${column.label} column`}
          title="Delete column"
          onClick={() => onDelete(column)}
          className="shrink-0 rounded px-0.5 text-[11px] text-indigo-300 opacity-0 transition group-hover/header:opacity-100 hover:text-red-500 focus:opacity-100"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
