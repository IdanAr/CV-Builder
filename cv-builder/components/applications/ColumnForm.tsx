'use client'

// Shared form for creating a custom column and editing an existing one
// (rename, and for select/status types: add/rename/recolor/remove options).
// Conceptually the same "user names a field, picks a type, it becomes usable"
// idea as the resume editor's CustomSection.
import { useState } from 'react'
import type { BoardColumn, ColumnOption, ColumnType } from '@/lib/schemas/application.zod'
import { X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

const TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  url: 'Link',
  select: 'Select',
  status: 'Status',
  checkbox: 'Checkbox',
}

const OPTION_COLOR_PRESETS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#64748b']

export interface ColumnFormResult {
  label: string
  type: ColumnType
  options?: ColumnOption[]
}

function newOption(index: number): ColumnOption {
  return {
    id: `opt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    color: OPTION_COLOR_PRESETS[index % OPTION_COLOR_PRESETS.length],
  }
}

export function ColumnForm({
  initial,
  onSubmit,
  onCancel,
}: {
  /** When set, the form edits this column: type is fixed, label/options editable. */
  initial?: BoardColumn
  onSubmit: (result: ColumnFormResult) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [type, setType] = useState<ColumnType>(initial?.type ?? 'text')
  const [options, setOptions] = useState<ColumnOption[]>(
    initial?.options?.map((o) => ({ ...o })) ?? [newOption(0)]
  )
  const isEdit = initial !== undefined
  const needsOptions = type === 'select' || type === 'status'
  const validOptions = options.filter((o) => o.label.trim() !== '')
  const canSubmit = label.trim() !== '' && (!needsOptions || validOptions.length > 0)

  // The board's Kanban lane order follows this array's order directly, so
  // reordering here is the only way a user can control lane order without
  // deleting and recreating options (and losing applications assigned to them).
  function reorderOption(index: number, direction: 'up' | 'down') {
    const swapWith = direction === 'up' ? index - 1 : index + 1
    setOptions((opts) => {
      if (swapWith < 0 || swapWith >= opts.length) return opts
      const next = [...opts]
      ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      label: label.trim(),
      type,
      options: needsOptions
        ? validOptions.map((o) => ({ ...o, label: o.label.trim() }))
        : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-3 text-left">
      <label className="flex flex-col gap-1 text-xs font-medium text-indigo-500">
        Column name
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Recruiter, Salary, Source"
          className="rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-sm text-indigo-900 outline-none focus:border-indigo-400"
        />
      </label>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-indigo-500">
          Type
          <select
            value={type}
            disabled={isEdit}
            onChange={(e) => setType(e.target.value as ColumnType)}
            className="mt-1 block w-full rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-sm text-indigo-900 outline-none focus:border-indigo-400 disabled:bg-indigo-50 disabled:text-indigo-400"
          >
            {(Object.keys(TYPE_LABELS) as ColumnType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {isEdit && <p className="text-xs text-indigo-400">Type can&apos;t be changed after creation.</p>}
      </div>

      {needsOptions && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium text-indigo-500">Options</legend>
          {options.map((option, i) => (
            <div key={option.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  aria-label={`Color for option ${i + 1}`}
                  value={option.color}
                  onChange={(e) =>
                    setOptions((opts) =>
                      opts.map((o) => (o.id === option.id ? { ...o, color: e.target.value } : o))
                    )
                  }
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border border-indigo-200 bg-white p-0.5"
                />
                <input
                  aria-label={`Label for option ${i + 1}`}
                  value={option.label}
                  placeholder="Option label"
                  onChange={(e) =>
                    setOptions((opts) =>
                      opts.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o))
                    )
                  }
                  className="min-w-0 flex-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-sm text-indigo-900 outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  aria-label={`Move option ${i + 1} up`}
                  onClick={() => reorderOption(i, 'up')}
                  disabled={i === 0}
                  className="shrink-0 rounded px-1 text-sm text-indigo-300 hover:text-indigo-600 disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move option ${i + 1} down`}
                  onClick={() => reorderOption(i, 'down')}
                  disabled={i === options.length - 1}
                  className="shrink-0 rounded px-1 text-sm text-indigo-300 hover:text-indigo-600 disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => setOptions((opts) => opts.filter((o) => o.id !== option.id))}
                  disabled={options.length === 1}
                  className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'h-6 w-6 shrink-0 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}
                ><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
              </div>
              <div className="ml-1 flex flex-wrap gap-1">
                {OPTION_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Set color to ${color}`}
                    onClick={() =>
                      setOptions((opts) =>
                        opts.map((o) => (o.id === option.id ? { ...o, color } : o))
                      )
                    }
                    style={{ backgroundColor: color }}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border border-indigo-200"
                  />
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions((opts) => [...opts, newOption(opts.length)])}
            className="self-start rounded px-1 py-0.5 text-xs font-medium text-indigo-500 hover:text-indigo-700"
          >
            + Add option
          </button>
        </fieldset>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isEdit ? 'Save column' : 'Add column'}
        </button>
      </div>
    </form>
  )
}
