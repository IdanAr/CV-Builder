'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'
import { labelClass } from './field'

export interface ToggleChipGroupProps<T extends string | number> {
  label: string
  options: readonly T[]
  selected: readonly T[]
  onToggle: (option: T) => void
  format?: (option: T) => string
}

/** Pressable chips for a small closed set. Selection semantics belong to the caller. */
export function ToggleChipGroup<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  format = String,
}: ToggleChipGroupProps<T>) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className={labelClass}>
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const pressed = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              aria-pressed={pressed}
              onClick={() => onToggle(option)}
              className={cn(
                'inline-flex min-h-8 items-center rounded-control border px-3 py-1 text-sm max-sm:min-h-10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                pressed
                  ? 'border-primary bg-primary font-medium text-primary-fg'
                  : 'border-border bg-surface text-fg-body hover:border-input hover:bg-surface-subtle'
              )}
            >
              {format(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
