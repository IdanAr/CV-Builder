'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { PAIRINGS, matchPairing } from '@/lib/fonts/pairings'
import { FONT_SUBSTITUTES, webFontFamily } from '@/lib/fonts/families'
import { SegmentedControl } from './SegmentedControl'

type Target = 'body' | 'headings'

const FONT_NAMES = Object.keys(FONT_SUBSTITUTES)
const TARGET_OPTIONS = [
  { id: 'body', label: 'Body' },
  { id: 'headings', label: 'Headings' },
]

const OPTION_BASE =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors'
const SELECTED = 'border-accent-600 ring-1 ring-accent-600 bg-surface'
const UNSELECTED = 'border-border bg-surface hover:bg-surface-subtle'

export function FontSection() {
  const fontFamily = useResumeEditorStore((s) => s.meta.fontFamily)
  const headerFontFamily = useResumeEditorStore((s) => s.meta.headerFontFamily)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const [target, setTarget] = useState<Target>('body')

  const heading = headerFontFamily ?? fontFamily
  const body = fontFamily
  const matched = matchPairing(heading, body)
  const current = target === 'body' ? body : heading

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

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i + 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(PAIRINGS.length - 1) }
  }

  const fontRefs = useRef<Array<HTMLButtonElement | null>>([])
  const currentIndex = FONT_NAMES.indexOf(current)
  const fontTabbable = currentIndex === -1 ? 0 : currentIndex

  function moveFont(to: number) {
    const next = (to + FONT_NAMES.length) % FONT_NAMES.length
    chooseFont(FONT_NAMES[next])
    fontRefs.current[next]?.focus()
  }

  function onFontKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); moveFont(i + 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); moveFont(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); moveFont(0) }
    else if (e.key === 'End') { e.preventDefault(); moveFont(FONT_NAMES.length - 1) }
  }

  function chooseFont(name: string) {
    if (name === current) return
    setMeta(target === 'body' ? { fontFamily: name } : { headerFontFamily: name })
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-medium text-fg">Font pairing</span>
          {!matched && <span className="text-xs text-fg-subtle">Custom</span>}
        </div>
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
                tabIndex={i === tabbable ? 0 : -1}
                onClick={() => choosePairing(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  'min-h-10 rounded-card border p-2 text-left',
                  OPTION_BASE,
                  checked ? SELECTED : UNSELECTED
                )}
              >
                <span style={{ fontFamily: webFontFamily(p.heading) }} className="block text-lg text-fg">Aa</span>
                <span className="block text-xs font-medium text-fg">{p.label}</span>
                <span className="block text-xs text-fg-muted">{`${p.heading} / ${p.body}`}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-medium text-fg">Customize</span>
        <SegmentedControl
          label="Customize font target"
          options={TARGET_OPTIONS}
          value={target}
          onChange={(id) => setTarget(id as Target)}
        />
        <div
          role="radiogroup"
          aria-label={target === 'body' ? 'Fonts for body' : 'Fonts for headings'}
          className="flex flex-col gap-1"
        >
          {FONT_NAMES.map((name, i) => {
            const checked = name === current
            return (
              <button
                key={name}
                ref={(el) => { fontRefs.current[i] = el }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={i === fontTabbable ? 0 : -1}
                onClick={() => chooseFont(name)}
                onKeyDown={(e) => onFontKeyDown(e, i)}
                style={{ fontFamily: webFontFamily(name) }}
                className={cn(
                  'min-h-10 w-full rounded-control border px-3 text-left text-sm text-fg sm:min-h-8',
                  OPTION_BASE,
                  checked ? SELECTED : UNSELECTED
                )}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
