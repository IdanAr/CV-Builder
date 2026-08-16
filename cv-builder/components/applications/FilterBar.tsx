'use client'

// Filter bar above the grid/board: a "+ Filter" popover with a per-column-type
// editor, and active filters rendered as removable chips. Applies to both
// Table and Kanban views identically.
import { useEffect, useRef, useState } from 'react'
import type { BoardColumn } from '@/lib/schemas/application.zod'
import {
  describeFilter,
  filterTypeForColumn,
  type ColumnFilter,
} from '@/lib/applications/filter'

function FilterEditor({
  column,
  initialFilter,
  onApply,
}: {
  column: BoardColumn
  initialFilter?: ColumnFilter
  onApply: (filter: ColumnFilter) => void
}) {
  const kind = filterTypeForColumn(column)
  const [query, setQuery] = useState(
    initialFilter?.kind === 'text' ? initialFilter.query : ''
  )
  const [optionIds, setOptionIds] = useState<string[]>(
    initialFilter?.kind === 'options' ? initialFilter.optionIds : []
  )
  const [min, setMin] = useState(
    initialFilter?.kind === 'range' && initialFilter.min !== undefined ? String(initialFilter.min) : ''
  )
  const [max, setMax] = useState(
    initialFilter?.kind === 'range' && initialFilter.max !== undefined ? String(initialFilter.max) : ''
  )
  const [from, setFrom] = useState(
    initialFilter?.kind === 'dateRange' ? initialFilter.from ?? '' : ''
  )
  const [to, setTo] = useState(initialFilter?.kind === 'dateRange' ? initialFilter.to ?? '' : '')
  const [checked, setChecked] = useState(
    initialFilter?.kind === 'checkbox' ? initialFilter.value : true
  )

  function apply(e: React.FormEvent) {
    e.preventDefault()
    switch (kind) {
      case 'options':
        if (optionIds.length === 0) return
        onApply({ columnId: column.id, kind, optionIds })
        break
      case 'text':
        if (query.trim() === '') return
        onApply({ columnId: column.id, kind, query: query.trim() })
        break
      case 'range': {
        const minN = min.trim() === '' ? undefined : Number(min)
        const maxN = max.trim() === '' ? undefined : Number(max)
        if (minN === undefined && maxN === undefined) return
        onApply({ columnId: column.id, kind, min: minN, max: maxN })
        break
      }
      case 'dateRange':
        if (from === '' && to === '') return
        onApply({
          columnId: column.id,
          kind,
          from: from || undefined,
          to: to || undefined,
        })
        break
      case 'checkbox':
        onApply({ columnId: column.id, kind, value: checked })
        break
    }
  }

  const inputClass =
    'rounded-md border border-indigo-200 bg-white px-2 py-1 text-sm text-indigo-900 outline-none focus:border-indigo-400'

  return (
    <form onSubmit={apply} className="flex flex-col gap-2">
      {kind === 'options' && (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {(column.options ?? []).map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-indigo-900">
              <input
                type="checkbox"
                checked={optionIds.includes(option.id)}
                onChange={(e) =>
                  setOptionIds((ids) =>
                    e.target.checked ? [...ids, option.id] : ids.filter((id) => id !== option.id)
                  )
                }
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
              {option.label}
            </label>
          ))}
        </div>
      )}
      {kind === 'text' && (
        <input
          autoFocus
          aria-label={`${column.label} contains`}
          placeholder="Contains…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
        />
      )}
      {kind === 'range' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            aria-label={`Minimum ${column.label}`}
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className={`w-24 ${inputClass}`}
          />
          <span className="text-indigo-300">–</span>
          <input
            type="number"
            aria-label={`Maximum ${column.label}`}
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className={`w-24 ${inputClass}`}
          />
        </div>
      )}
      {kind === 'dateRange' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label={`${column.label} from`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
          <span className="text-indigo-300">–</span>
          <input
            type="date"
            aria-label={`${column.label} until`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
      {kind === 'checkbox' && (
        <label className="flex items-center gap-2 text-sm text-indigo-900">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          Only {checked ? 'checked' : 'unchecked'} rows
        </label>
      )}
      <button
        type="submit"
        className="self-end rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
      >
        Apply filter
      </button>
    </form>
  )
}

export function FilterBar({
  columns,
  filters,
  onChange,
}: {
  columns: BoardColumn[]
  filters: ColumnFilter[]
  onChange: (filters: ColumnFilter[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [columnId, setColumnId] = useState<string>('')
  const ref = useRef<HTMLDivElement>(null)
  const columnById = new Map(columns.map((c) => [c.id, c]))
  const selected = columnId ? columnById.get(columnId) : undefined

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o)
            setColumnId('')
          }}
          className="rounded-md border border-indigo-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
        >
          + Filter
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-indigo-100 bg-white p-3 shadow-xl">
            <label className="flex flex-col gap-1 text-xs font-medium text-indigo-500">
              Filter by
              <select
                autoFocus
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-sm text-indigo-900 outline-none focus:border-indigo-400"
              >
                <option value="">Choose a column…</option>
                {[...columns]
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </label>
            {selected && (
              <div className="mt-2">
                <FilterEditor
                  // Reset editor state when the column changes.
                  key={selected.id}
                  column={selected}
                  initialFilter={filters.find((f) => f.columnId === selected.id)}
                  onApply={(filter) => {
                    // One filter per column: replace any existing one.
                    onChange([...filters.filter((f) => f.columnId !== filter.columnId), filter])
                    setOpen(false)
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {filters.map((filter) => {
        const column = columnById.get(filter.columnId)
        if (!column) return null
        return (
          <span
            key={filter.columnId}
            className="flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50/80 py-0.5 pl-2.5 pr-1 text-xs font-medium text-indigo-700"
          >
            {describeFilter(filter, column)}
            <button
              type="button"
              aria-label={`Remove filter on ${column.label}`}
              onClick={() => onChange(filters.filter((f) => f.columnId !== filter.columnId))}
              className="rounded-full px-1 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700"
            >
              ✕
            </button>
          </span>
        )
      })}
      {filters.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded px-1.5 py-0.5 text-xs text-indigo-400 hover:text-indigo-600"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
