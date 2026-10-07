'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentOption { id: string; label: string }

interface SegmentedControlProps {
  label: string
  options: SegmentOption[]
  value: string | undefined
  onChange: (id: string) => void
}

export function SegmentedControl({ label, options, value, onChange }: SegmentedControlProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = options.findIndex((o) => o.id === value)
  const tabbable = selectedIndex === -1 ? 0 : selectedIndex

  function move(to: number) {
    const next = (to + options.length) % options.length
    if (next !== selectedIndex) onChange(options[next].id)
    refs.current[next]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(index + 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(index - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(options.length - 1) }
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-control border border-border bg-surface-subtle p-0.5">
      {options.map((o, i) => {
        const checked = i === selectedIndex
        return (
          <button
            key={o.id}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === tabbable ? 0 : -1}
            onClick={() => { if (!checked) onChange(o.id) }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'min-h-10 flex-1 rounded-chip sm:min-h-[32px] px-2 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              checked ? 'bg-surface text-fg-heading shadow-sm ring-1 ring-border' : 'text-fg-muted hover:text-fg-body'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
