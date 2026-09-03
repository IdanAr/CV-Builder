'use client'

import { useId, useState, useEffect } from 'react'
import { inputClass } from './field-styles'
import { cn } from '@/lib/utils'

export interface MonthYearPickerProps {
  value: string          // "YYYY-MM", "" for empty, or "Present" (end dates only)
  onChange: (v: string) => void
  allowPresent?: boolean // shows a "Present" toggle checkbox when true
  placeholder?: string   // label shown when empty
}

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
]

/**
 * Compose this with `cn()` at each call site, never with a template string.
 *
 * The shared `inputClass` carries `w-full`, and Tailwind emits `.w-full` after
 * `.w-20`/`.w-16` in the stylesheet. Both are single-class selectors, so with
 * plain interpolation the two widths would both survive into the class
 * attribute and source order alone would decide — the field would stretch to
 * fill its column and shove the "Present" toggle out of the row. `cn()` runs
 * twMerge, which drops the losing width before it ever reaches the DOM.
 */
const fieldClass = cn(inputClass, 'px-2 py-1 appearance-none')

function parseValue(value: string): { year: string; month: string; isPresent: boolean } {
  if (value === 'Present') {
    return { year: '', month: '', isPresent: true }
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-')
    return { year, month, isPresent: false }
  }
  if (/^\d{4}$/.test(value)) {
    return { year: value, month: '', isPresent: false }
  }
  return { year: '', month: '', isPresent: false }
}

export function MonthYearPicker({ value, onChange, allowPresent = false, placeholder }: MonthYearPickerProps) {
  // Unique per rendered instance so month/year <label htmlFor> ids never
  // collide when multiple pickers (e.g. start + end date) render on one page.
  const baseId = useId()
  const monthId = `${baseId}-month`
  const yearId = `${baseId}-year`
  const parsed = parseValue(value)
  const [month, setMonth] = useState(parsed.month)
  const [year, setYear] = useState(parsed.year)
  const [isPresent, setIsPresent] = useState(parsed.isPresent)

  // Sync internal state when external value changes
  useEffect(() => {
    const p = parseValue(value)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(p.month)
    setYear(p.year)
    setIsPresent(p.isPresent)
  }, [value])

  function emitChange(nextMonth: string, nextYear: string, nextPresent: boolean) {
    if (nextPresent && allowPresent) {
      onChange('Present')
      return
    }
    if (nextYear && nextMonth) {
      onChange(`${nextYear}-${nextMonth}`)
    } else if (nextYear) {
      onChange(nextYear)
    } else {
      onChange('')
    }
  }

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const m = e.target.value
    setMonth(m)
    emitChange(m, year, isPresent)
  }

  function handleYearChange(e: React.ChangeEvent<HTMLInputElement>) {
    setYear(e.target.value)
    // Emit on every change so store stays in sync with partial input
    const y = e.target.value
    if (/^\d{4}$/.test(y) || y === '') {
      emitChange(month, y, isPresent)
    }
  }

  function handleYearBlur(e: React.FocusEvent<HTMLInputElement>) {
    const y = e.target.value
    if (y !== '' && !/^\d{4}$/.test(y)) {
      setYear('')
      emitChange(month, '', isPresent)
    }
  }

  function handlePresentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked
    setIsPresent(checked)
    emitChange(month, year, checked)
  }

  if (isPresent && allowPresent) {
    return (
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-indigo-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isPresent}
            onChange={handlePresentChange}
            className="rounded border-indigo-300 text-indigo-500 focus:ring-indigo-500"
          />
          Present
        </label>
      </div>
    )
  }

  return (
    // Wraps rather than overflows. The end-date variant needs roughly 224px
    // (80 + 64 for the fields, plus gaps, the checkbox and its label), but the
    // forms lay these out in a two-column grid inside an editor panel that is
    // narrower than that per column. Without `flex-wrap` the "Present" toggle
    // has nowhere to go — `whitespace-nowrap` keeps it from breaking, so it
    // spills over the year field and out of the card. `min-w-0` lets this box
    // actually shrink inside its grid track, whose default `min-width: auto`
    // would otherwise refuse to go below the content width.
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <label htmlFor={monthId} className="sr-only">
        {placeholder ? `${placeholder} month` : 'Month'}
      </label>
      <select
        id={monthId}
        value={month}
        onChange={handleMonthChange}
        className={cn(fieldClass, 'w-20')}
      >
        <option value="">Month</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <label htmlFor={yearId} className="sr-only">
        {placeholder ? `${placeholder} year` : 'Year'}
      </label>
      <input
        id={yearId}
        type="text"
        value={year}
        onChange={handleYearChange}
        onBlur={handleYearBlur}
        maxLength={4}
        placeholder="YYYY"
        className={cn(fieldClass, 'w-16')}
      />

      {allowPresent && (
        <label className="flex items-center gap-1 text-xs text-indigo-500 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={isPresent}
            onChange={handlePresentChange}
            className="rounded border-indigo-300 text-indigo-500 focus:ring-indigo-500"
          />
          Present
        </label>
      )}
    </div>
  )
}
