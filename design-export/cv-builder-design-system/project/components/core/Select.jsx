import React from 'react'

/* Native select styled to match the Design panel dropdowns. */
export function Select({ value, onChange, options = [], disabled = false, style = {}, ...rest }) {
  return (
    <select
      value={value} onChange={onChange} disabled={disabled}
      style={{
        width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: '14px',
        color: 'var(--text-heading)', background: 'rgba(255,255,255,0.7)',
        padding: '7px 28px 7px 10px', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', outline: 'none', cursor: 'pointer', appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23818cf8\' stroke-width=\'2.5\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
        ...style,
      }}
      {...rest}
    >
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return <option key={val} value={val}>{label}</option>
      })}
    </select>
  )
}
