'use client'

import { useId, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { fieldClass, helperClass, labelClass } from './field'

export function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-chip bg-surface-subtle py-0.5 pl-2.5 pr-0.5 text-sm text-fg-body max-sm:min-h-10 max-sm:py-0">
      <span className="truncate" title={label}>
        {label}
      </span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-chip text-fg-muted hover:bg-surface-selected hover:text-fg-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:h-10 max-sm:w-10"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

export interface TagInputProps {
  id: string
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  helper?: string
  max?: number
}

/**
 * A list of short strings entered as tags: Enter or a comma adds, Backspace on
 * an empty field removes the last, a pasted comma-separated list splits, and
 * pending text is committed on blur so pressing Next never drops it.
 */
export function TagInput({ id, label, values, onChange, placeholder, helper, max }: TagInputProps) {
  const [text, setText] = useState('')
  const helperId = useId()

  /** Returns true when the cap stopped a new, non-duplicate entry from being added. */
  function addMany(parts: string[]): boolean {
    let blockedByMax = false
    const seen = new Set(values.map((v) => v.toLowerCase()))
    const added: string[] = []
    for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
      const key = part.toLowerCase()
      if (seen.has(key)) continue
      if (max !== undefined && values.length + added.length >= max) {
        blockedByMax = true
        break
      }
      seen.add(key)
      added.push(part)
    }
    if (added.length > 0) onChange([...values, ...added])
    return blockedByMax
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    if (next.includes(',')) {
      const parts = next.split(',')
      addMany(parts.slice(0, -1))
      setText(parts[parts.length - 1])
    } else {
      setText(next)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.key === 'Process') return
    if (event.key === 'Enter') {
      event.preventDefault()
      // Keep the text when the cap blocked it; a duplicate is simply cleared.
      if (!addMany([text])) setText('')
    } else if (event.key === 'Backspace' && !event.repeat && text === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  function handleBlur() {
    if (text.trim() && !addMany([text])) setText('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <TagChip key={value} label={value} onRemove={() => onChange(values.filter((v) => v !== value))} />
          ))}
        </div>
      )}
      <input
        id={id}
        className={fieldClass}
        value={text}
        placeholder={placeholder}
        aria-describedby={helper ? helperId : undefined}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {helper && (
        <p id={helperId} className={helperClass}>
          {helper}
        </p>
      )}
    </div>
  )
}
