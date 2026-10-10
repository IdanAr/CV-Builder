'use client'

import React from 'react'

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
  /** Show the single-colour quick-pick row. Off where a theme picker already covers it. */
  showPresets?: boolean
}

export function ColorField({ label, value, onCommit, swatchLabel, presetsLabel, placeholder, showPresets = true }: ColorFieldProps) {
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
      {/* One control: the swatch opens the native picker, the hex is typed beside it. */}
      <div className="flex min-h-10 items-center gap-2 rounded-control border border-input bg-surface pl-1 pr-2 focus-within:ring-2 focus-within:ring-ring sm:min-h-9">
        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-chip ring-1 ring-border" style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            onChange={handleSwatchChange}
            aria-label={swatchLabel}
            title="Pick a custom color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <input
          id={textId}
          type="text"
          value={draft}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder={placeholder}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-fg focus-visible:outline-none"
        />
      </div>
      {showPresets && (
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={presetsLabel}>
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
              className={`h-6 w-6 rounded-full border-2 motion-safe:transition-transform motion-safe:hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                isActive ? 'border-primary ring-2 ring-ring ring-offset-1' : 'border-surface ring-1 ring-border'
              }`}
            />
          )
        })}
      </div>
      )}
      {touched && !HEX_COLOR_RE.test(draft) && (
        <p className="mt-1 text-sm text-fg-danger">Enter a valid hex color (e.g. #0066cc)</p>
      )}
    </div>
  )
}
