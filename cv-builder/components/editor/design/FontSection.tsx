'use client'

import { useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { PAIRINGS, matchPairing } from '@/lib/fonts/pairings'
import { DEFAULT_PICKER_FONT, FONT_SUBSTITUTES, isSerifFont, webFontFamily } from '@/lib/fonts/families'
import { Popover } from '@/components/ui/Popover'

const FONT_NAMES = Object.keys(FONT_SUBSTITUTES)

const OPTION_BASE =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'

/** Arrow/Home/End roving selection shared by the pairing cards and the font list. */
function rovingKeys(e: React.KeyboardEvent, i: number, count: number, move: (to: number) => void) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i + 1) }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i - 1) }
  else if (e.key === 'Home') { e.preventDefault(); move(0) }
  else if (e.key === 'End') { e.preventDefault(); move(count - 1) }
}

interface FontPickerProps {
  label: 'Headings' | 'Body'
  value: string
  onChange: (name: string) => void
}

function FontPicker({ label, value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const currentIndex = FONT_NAMES.indexOf(value)
  const tabbable = currentIndex === -1 ? 0 : currentIndex

  function choose(name: string) {
    if (name !== value) onChange(name)
  }

  function move(to: number) {
    const next = (to + FONT_NAMES.length) % FONT_NAMES.length
    choose(FONT_NAMES[next])
    refs.current[next]?.focus()
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-fg-muted">{label}</span>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`${label} font: ${value}`}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-between gap-2 rounded-control border border-input bg-surface px-3 text-left text-sm text-fg hover:bg-surface-subtle sm:min-h-9',
              OPTION_BASE
            )}
          >
            <span style={{ fontFamily: webFontFamily(value) }} className="truncate">{value}</span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-subtle" />
          </button>
        }
      >
        <div className="w-60 rounded-overlay border border-border bg-surface p-1 shadow-popover">
          <div
            role="radiogroup"
            aria-label={label === 'Body' ? 'Fonts for body' : 'Fonts for headings'}
            className="flex flex-col"
          >
            {FONT_NAMES.map((name, i) => {
              const checked = name === value
              return (
                <button
                  key={name}
                  ref={(el) => { refs.current[i] = el }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={name}
                  tabIndex={i === tabbable ? 0 : -1}
                  onClick={() => { choose(name); setOpen(false) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); setOpen(false); return }
                    rovingKeys(e, i, FONT_NAMES.length, move)
                  }}
                  className={cn(
                    'flex min-h-10 w-full items-center gap-2 rounded-control px-2 text-left sm:min-h-9',
                    OPTION_BASE,
                    checked ? 'bg-surface-selected' : 'hover:bg-surface-subtle'
                  )}
                >
                  <span style={{ fontFamily: webFontFamily(name) }} className="flex-1 text-sm text-fg">{name}</span>
                  <span className="text-xs text-fg-subtle">{isSerifFont(name) ? 'Serif' : 'Sans'}</span>
                  <Check aria-hidden="true" className={cn('h-4 w-4 text-primary', checked ? 'opacity-100' : 'opacity-0')} />
                </button>
              )
            })}
          </div>
        </div>
      </Popover>
    </div>
  )
}

export function FontSection() {
  const fontFamily = useResumeEditorStore((s) => s.meta.fontFamily)
  const headerFontFamily = useResumeEditorStore((s) => s.meta.headerFontFamily)
  const name = useResumeEditorStore((s) => s.data.basics?.name)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const heading = headerFontFamily ?? DEFAULT_PICKER_FONT
  const body = fontFamily
  const matched = matchPairing(heading, body)
  const specimenName = name?.trim() || 'Your Name'

  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = PAIRINGS.findIndex((p) => p.id === matched?.id)
  const tabbable = selectedIndex === -1 ? 0 : selectedIndex

  function choosePairing(i: number) {
    const p = PAIRINGS[i]
    if (p.id === matched?.id) return
    setMeta({ headerFontFamily: p.heading, fontFamily: p.body })
  }

  function move(to: number) {
    const next = (to + PAIRINGS.length) % PAIRINGS.length
    choosePairing(next)
    cardRefs.current[next]?.focus()
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Font pairing" className="grid grid-cols-2 gap-2">
        {PAIRINGS.map((p, i) => {
          const checked = i === selectedIndex
          return (
            <button
              key={p.id}
              ref={(el) => { cardRefs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${p.label}: ${p.heading} headings, ${p.body} body`}
              tabIndex={i === tabbable ? 0 : -1}
              onClick={() => choosePairing(i)}
              onKeyDown={(e) => rovingKeys(e, i, PAIRINGS.length, move)}
              className={cn(
                'relative flex flex-col gap-1 overflow-hidden rounded-card border bg-surface p-3 text-left',
                OPTION_BASE,
                checked ? 'border-primary ring-1 ring-ring' : 'border-border hover:border-input'
              )}
            >
              {checked && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-fg">
                  <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span
                data-testid="pairing-heading-sample"
                style={{ fontFamily: webFontFamily(p.heading) }}
                className="block truncate pr-4 text-base text-fg-heading"
              >
                {specimenName}
              </span>
              <span
                data-testid="pairing-body-sample"
                style={{ fontFamily: webFontFamily(p.body) }}
                className="block text-xs leading-snug text-fg-body"
              >
                Led a team of 12 engineers.
              </span>
              <span className="mt-1 block text-xs text-fg-subtle">{p.label}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-fg-body">Fine-tune</span>
          {!matched && <span className="text-xs text-fg-subtle">Custom pairing</span>}
        </div>
        <FontPicker label="Headings" value={heading} onChange={(f) => setMeta({ headerFontFamily: f })} />
        <FontPicker label="Body" value={body} onChange={(f) => setMeta({ fontFamily: f })} />
      </div>
    </div>
  )
}
