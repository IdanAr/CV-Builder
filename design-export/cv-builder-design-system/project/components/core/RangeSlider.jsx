import React from 'react'

/* Labelled range control from the Design panel (margins, line spacing).
   Shows the current value inline and the min/max captions below. */
export function RangeSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange, minLabel, maxLabel }) {
  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--brand-primary)', marginBottom: '6px' }}>
          {label} — <span style={{ fontFamily: 'var(--font-mono)' }}>{value}{unit}</span>
        </label>
      )}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange && onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--brand-primary)', cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
        <span>{minLabel ?? `${min}${unit}`}</span>
        <span>{maxLabel ?? `${max}${unit}`}</span>
      </div>
    </div>
  )
}
