'use client'

import { useId, useState, useEffect } from 'react'

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

const fieldClass =
  'border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

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
    <div className="flex items-center gap-1.5">
      <label htmlFor={monthId} className="sr-only">
        {placeholder ? `${placeholder} month` : 'Month'}
      </label>
      <select
        id={monthId}
        value={month}
        onChange={handleMonthChange}
        className={`${fieldClass} w-20`}
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
        className={`${fieldClass} w-16`}
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
