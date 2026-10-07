'use client'

import React from 'react'
import { inputClass } from '../forms/field-styles'
import { cn } from '@/lib/utils'

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}){1,2}$/

// A curated set of professional, resume-appropriate colors shown as a quick-pick
// palette, so the color controls visually read as "a palette to choose from"
// rather than a single opaque swatch + hex box. Free-form custom colors are
// still available via the native picker and the hex text input.
const PRESET_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#1f2937' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Classic Blue', hex: '#0066cc' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Forest Green', hex: '#15803d' },
  { name: 'Burgundy', hex: '#9f1239' },
  { name: 'Violet', hex: '#7c3aed' },
]

interface ColorFieldProps {
  label: string
  value: string
  onCommit: (hex: string) => void
  swatchLabel: string
  presetsLabel: string
  placeholder: string
}

export function ColorField({ label, value, onCommit, swatchLabel, presetsLabel, placeholder }: ColorFieldProps) {
  const textId = React.useId()
  const [draft, setDraft] = React.useState(value)
  const [touched, setTouched] = React.useState(false)

  // Keep the draft in sync when the value changes from *outside* this
  // component's own inputs (undo/redo, loading a different resume, etc.) —
  // without this, the text field would keep showing a stale value after an
  // external change even though the swatch (which reads `value` directly)
  // updates correctly. This is a no-op when the change originated from this
  // component's own valid-hex commit, since the draft already equals `value`.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value)
    setTouched(false)
  }, [value])

  function handleSwatchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    onCommit(next)
    setDraft(next)
    setTouched(false)
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setDraft(next)
    setTouched(true)
    if (HEX_COLOR_RE.test(next)) onCommit(next)
  }

  function handleTextBlur() {
    if (!HEX_COLOR_RE.test(draft)) {
      setDraft(value)
      setTouched(false)
    }
  }

  function handlePresetSelect(hex: string) {
    onCommit(hex)
    setDraft(hex)
    setTouched(false)
  }

  return (
    <div>
      <label htmlFor={textId} className="mb-1 block text-xs font-medium text-fg-muted">{label}</label>
      <div className="mb-2 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={handleSwatchChange}
          aria-label={swatchLabel}
          title="Custom color"
          className="h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white p-0 shadow ring-1 ring-accent-200"
        />
        <input
          id={textId}
          type="text"
          value={draft}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder={placeholder}
          className={cn(inputClass, 'w-auto flex-1 px-2 py-1 text-xs font-mono focus:ring-1')}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={presetsLabel}>
        {PRESET_COLORS.map(({ name, hex }) => {
          const isActive = value.toLowerCase() === hex.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              title={name}
              aria-label={`Set ${label.toLowerCase()} to ${name}`}
              aria-pressed={isActive}
              onClick={() => handlePresetSelect(hex)}
              style={{ backgroundColor: hex }}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-1 ${
                isActive ? 'border-accent-600 ring-2 ring-accent-300 ring-offset-1' : 'border-white shadow-sm'
              }`}
            />
          )
        })}
      </div>
      {touched && !HEX_COLOR_RE.test(draft) && (
        <p className="mt-1 text-sm text-fg-danger">Enter a valid hex color (e.g. #0066cc)</p>
      )}
    </div>
  )
}
