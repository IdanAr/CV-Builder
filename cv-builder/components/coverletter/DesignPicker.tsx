'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { LetterDesign } from '@/lib/coverletter/design'

interface DesignOption {
  id: LetterDesign
  label: string
}

const OPTIONS: DesignOption[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'accent-edge', label: 'Accent edge' },
]

/** A few grey lines standing in for the paragraphs under the heading. */
function BodyLines() {
  return (
    <div className="space-y-1">
      <div className="h-0.5 w-full rounded-full bg-surface-muted" />
      <div className="h-0.5 w-full rounded-full bg-surface-muted" />
      <div className="h-0.5 w-2/3 rounded-full bg-surface-muted" />
    </div>
  )
}

/** The classic letter: a centred name bar over a thin accent rule. */
function ClassicPreview() {
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex flex-col items-center gap-1">
        <div className="h-1.5 w-8 rounded-full bg-fg-body" />
        <div className="h-px w-full bg-primary" />
      </div>
      <BodyLines />
    </div>
  )
}

/** The accent-edge letter: a bar down the left edge beside the name lines. */
function AccentEdgePreview() {
  return (
    <div className="flex h-full gap-1.5">
      <div className="w-1 shrink-0 rounded-full bg-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="space-y-1">
          <div className="h-1.5 w-8 rounded-full bg-fg-body" />
          <div className="h-0.5 w-5 rounded-full bg-fg-muted" />
        </div>
        <BodyLines />
      </div>
    </div>
  )
}

/**
 * Chooses the letter's export design. A radio group: the selected option is
 * the one tab stop, and the arrow keys move the choice, like the Design
 * panel's segmented controls. The previews are static markup in design
 * tokens, not the CV's own colours.
 */
export function DesignPicker({ value, onChange }: { value: LetterDesign; onChange: (design: LetterDesign) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = OPTIONS.findIndex((o) => o.id === value)
  const tabbable = selectedIndex === -1 ? 0 : selectedIndex

  function move(to: number) {
    const next = (to + OPTIONS.length) % OPTIONS.length
    if (next !== selectedIndex) onChange(OPTIONS[next].id)
    refs.current[next]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(index + 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(index - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(OPTIONS.length - 1) }
  }

  return (
    <div role="radiogroup" aria-label="Letter design" className="flex gap-2">
      {OPTIONS.map((o, i) => {
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
              'flex w-24 flex-col gap-1.5 rounded-card border bg-surface p-1.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              checked ? 'border-primary ring-1 ring-ring' : 'border-border hover:border-input'
            )}
          >
            <span aria-hidden="true" className="block h-14 rounded-chip border border-border-subtle bg-surface-page p-1.5">
              {o.id === 'classic' ? <ClassicPreview /> : <AccentEdgePreview />}
            </span>
            <span className={cn('px-0.5 text-xs font-medium', checked ? 'text-primary' : 'text-fg-body')}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
