'use client'

import { useRef, useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { COLOR_THEMES, matchColorTheme } from '@/lib/editor/color-themes'
import { cn } from '@/lib/utils'
import { ColorField } from './ColorField'

/** Two-tone dot: primary on the left half, accent on the right. */
export function ThemeDot({ primary, accent, className }: { primary: string; accent: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative inline-flex overflow-hidden rounded-full ring-1 ring-border', className)}>
      <span className="h-full w-1/2" style={{ backgroundColor: primary }} />
      <span className="h-full w-1/2" style={{ backgroundColor: accent }} />
    </span>
  )
}

export function ColorSection() {
  const primaryColor = useResumeEditorStore((s) => s.meta.primaryColor)
  const accentColor = useResumeEditorStore((s) => s.meta.accentColor)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const matched = matchColorTheme(primaryColor, accentColor)
  // Custom colours start open when the CV already uses an off-theme pair, so
  // the user sees where its colours came from.
  const [customOpen, setCustomOpen] = useState(!matched)

  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = COLOR_THEMES.findIndex((t) => t.id === matched?.id)
  const tabbable = selectedIndex === -1 ? 0 : selectedIndex

  function choose(i: number) {
    const t = COLOR_THEMES[i]
    if (t.id === matched?.id) return
    setMeta({ primaryColor: t.primary, accentColor: t.accent })
  }

  function move(to: number) {
    const next = (to + COLOR_THEMES.length) % COLOR_THEMES.length
    choose(next)
    refs.current[next]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i + 1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(COLOR_THEMES.length - 1) }
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Color theme" className="grid grid-cols-5 gap-x-1 gap-y-3">
        {COLOR_THEMES.map((t, i) => {
          const checked = i === selectedIndex
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={t.label}
              tabIndex={i === tabbable ? 0 : -1}
              onClick={() => choose(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className="group flex flex-col items-center gap-1 rounded-control py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'relative flex rounded-full p-0.5 ring-2 transition-colors',
                  checked ? 'ring-primary' : 'ring-transparent group-hover:ring-border'
                )}
              >
                <ThemeDot primary={t.primary} accent={t.accent} className="h-9 w-9" />
                {checked && (
                  <span className="absolute inset-0 flex items-center justify-center text-fg-on-accent">
                    <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className={cn('text-xs', checked ? 'font-medium text-fg-heading' : 'text-fg-muted')}>{t.label}</span>
            </button>
          )
        })}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((v) => !v)}
          className="flex min-h-10 w-full items-center gap-2 rounded-control px-1 text-xs font-medium text-fg-body hover:text-fg-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
          Custom colors
          {!matched && <span className="ml-auto rounded-full bg-surface-selected px-2 py-0.5 text-xs text-primary">In use</span>}
        </button>
        {customOpen && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <ColorField
              label="Primary color"
              value={primaryColor}
              onCommit={(hex) => setMeta({ primaryColor: hex })}
              swatchLabel="Custom primary color"
              presetsLabel="Primary color presets"
              placeholder="#000000"
              showPresets={false}
            />
            <ColorField
              label="Accent color"
              value={accentColor}
              onCommit={(hex) => setMeta({ accentColor: hex })}
              swatchLabel="Custom accent color"
              presetsLabel="Accent color presets"
              placeholder="#0066cc"
              showPresets={false}
            />
          </div>
        )}
        <p className="mt-2 px-1 text-xs text-fg-subtle">Primary colors your name and headings. Accent colors job titles, links and rules.</p>
      </div>
    </div>
  )
}
