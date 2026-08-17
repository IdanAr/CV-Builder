'use client'

// Type-specific, inline-editable cell renderers for the applications
// supertable. Every editable cell is click-to-edit: Enter/blur commits,
// Escape cancels — no separate "edit mode".
import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { ColumnOption, CustomFieldValue } from '@/lib/schemas/application.zod'
import type { ResumeOption } from '@/lib/applications/types'

export interface CellProps {
  value: CustomFieldValue
  onCommit: (next: CustomFieldValue) => void
  ariaLabel: string
}

function useCommitOnce() {
  // Blur fires after Enter's commit; guard so a single edit commits once.
  const committed = useRef(false)
  return {
    reset: () => {
      committed.current = false
    },
    commitOnce: (fn: () => void) => {
      if (committed.current) return
      committed.current = true
      fn()
    },
  }
}

function InlineTextInput({
  initial,
  type,
  ariaLabel,
  onDone,
}: {
  initial: string
  type: 'text' | 'number' | 'url' | 'date'
  ariaLabel: string
  onDone: (next: string | null) => void
}) {
  const [draft, setDraft] = useState(initial)
  const { commitOnce } = useCommitOnce()
  return (
    <input
      autoFocus
      type={type}
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commitOnce(() => onDone(draft))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitOnce(() => onDone(draft))
        if (e.key === 'Escape') commitOnce(() => onDone(null))
      }}
      className="w-full rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-sm text-indigo-900 outline-none focus:border-indigo-500"
    />
  )
}

function EditableCell({
  value,
  onCommit,
  ariaLabel,
  inputType,
  display,
  toValue,
}: CellProps & {
  inputType: 'text' | 'number' | 'url' | 'date'
  display: React.ReactNode
  toValue: (draft: string) => CustomFieldValue
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <InlineTextInput
        initial={value === null || value === undefined ? '' : String(value)}
        type={inputType}
        ariaLabel={ariaLabel}
        onDone={(draft) => {
          setEditing(false)
          if (draft === null) return
          const next = toValue(draft)
          if (next !== value && !(next === null && (value === null || value === ''))) {
            onCommit(next)
          }
        }}
      />
    )
  }
  return (
    <button
      type="button"
      aria-label={`Edit ${ariaLabel}`}
      onClick={() => setEditing(true)}
      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-sm text-indigo-900 hover:bg-indigo-50"
    >
      {display ?? <span className="text-indigo-300">—</span>}
    </button>
  )
}

export function TextCell(props: CellProps) {
  const text = props.value === null || props.value === undefined ? '' : String(props.value)
  return (
    <EditableCell
      {...props}
      inputType="text"
      display={text || null}
      toValue={(draft) => (draft.trim() === '' ? '' : draft)}
    />
  )
}

export function NumberCell(props: CellProps) {
  const text = typeof props.value === 'number' ? String(props.value) : ''
  return (
    <EditableCell
      {...props}
      value={props.value}
      inputType="number"
      display={text || null}
      toValue={(draft) => {
        if (draft.trim() === '') return null
        const n = Number(draft)
        return Number.isFinite(n) ? n : null
      }}
    />
  )
}

function formatDateDisplay(value: CustomFieldValue): string {
  if (typeof value !== 'string' || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function DateCell(props: CellProps & { readOnly?: boolean }) {
  const display = formatDateDisplay(props.value)
  if (props.readOnly) {
    return (
      <span className="block truncate px-1.5 py-0.5 text-sm text-indigo-900" aria-label={props.ariaLabel}>
        {display || <span className="text-indigo-300">—</span>}
      </span>
    )
  }
  // Custom date columns store 'YYYY-MM-DD'.
  const inputValue = typeof props.value === 'string' ? props.value.slice(0, 10) : ''
  return (
    <EditableCell
      {...props}
      value={inputValue}
      inputType="date"
      display={display || null}
      toValue={(draft) => (draft === '' ? null : draft)}
    />
  )
}

export function UrlCell(props: CellProps) {
  const url = typeof props.value === 'string' ? props.value : ''
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <InlineTextInput
        initial={url}
        type="url"
        ariaLabel={props.ariaLabel}
        onDone={(draft) => {
          setEditing(false)
          if (draft === null) return
          const next = draft.trim() === '' ? null : draft.trim()
          if (next !== (url || null)) props.onCommit(next)
        }}
      />
    )
  }
  return (
    <span className="flex w-full items-center gap-1 px-1.5 py-0.5">
      {url ? (
        <a
          href={url.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-sm text-indigo-600 underline decoration-indigo-300 hover:text-indigo-800"
        >
          {url}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-indigo-300">—</span>
      )}
      <button
        type="button"
        aria-label={`Edit ${props.ariaLabel}`}
        onClick={() => setEditing(true)}
        className="shrink-0 rounded px-1 text-xs text-indigo-400 opacity-0 transition group-hover/cell:opacity-100 hover:bg-indigo-50 hover:text-indigo-700 focus:opacity-100"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  )
}

export function CheckboxCell(props: CellProps) {
  return (
    <span className="flex px-1.5 py-0.5">
      <input
        type="checkbox"
        aria-label={props.ariaLabel}
        checked={props.value === true}
        onChange={(e) => props.onCommit(e.target.checked)}
        className="h-4 w-4 accent-indigo-600"
      />
    </span>
  )
}

/** Colored chip + dropdown; used for both 'select' and 'status' columns. */
export function SelectCell(props: CellProps & { options: ColumnOption[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = props.options.find((o) => o.id === props.value)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={ref} className="relative px-1 py-0.5">
      <button
        type="button"
        aria-label={`Change ${props.ariaLabel}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-indigo-50"
      >
        {selected ? (
          <span
            className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: selected.color }}
          >
            {selected.label}
          </span>
        ) : (
          <span className="text-sm text-indigo-300">—</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-lg border border-indigo-100 bg-white p-1 shadow-lg">
          {props.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setOpen(false)
                if (option.id !== props.value) props.onCommit(option.id)
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-indigo-50"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
              <span className="truncate text-indigo-900">{option.label}</span>
              {option.id === props.value && <span className="ml-auto text-indigo-500">✓</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              if (props.value !== null && props.value !== '') props.onCommit(null)
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-indigo-400 hover:bg-indigo-50"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

/** Dropdown of the user's resumes; value is the linked resumeId. */
export function ResumeCell(
  props: CellProps & { resumes: ResumeOption[]; resumeTitle?: string }
) {
  const current = typeof props.value === 'string' ? props.value : ''
  return (
    <span className="block px-1 py-0.5">
      <select
        aria-label={props.ariaLabel}
        value={current}
        onChange={(e) => {
          const next = e.target.value === '' ? null : e.target.value
          if (next !== (current || null)) props.onCommit(next)
        }}
        className="w-full truncate rounded border border-transparent bg-transparent px-0.5 py-0.5 text-sm text-indigo-900 hover:border-indigo-200 focus:border-indigo-400 focus:outline-none"
      >
        <option value="">— none —</option>
        {/* Keep a stale link visible even if the resume list no longer contains it. */}
        {current && !props.resumes.some((r) => r.id === current) && (
          <option value={current}>{props.resumeTitle ?? current}</option>
        )}
        {props.resumes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
    </span>
  )
}
