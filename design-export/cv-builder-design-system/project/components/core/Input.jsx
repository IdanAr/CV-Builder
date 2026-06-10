import React from 'react'

/* Text input matching the editor forms — soft white fill, indigo focus ring. */
export function Input({ value, onChange, placeholder, type = 'text', disabled = false, mono = false, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false)
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        width: '100%', boxSizing: 'border-box', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
        fontSize: '14px', color: 'var(--text-heading)',
        background: 'rgba(255,255,255,0.7)', padding: '7px 10px',
        border: `1px solid ${focus ? 'var(--ring-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-lg)', outline: 'none',
        boxShadow: focus ? '0 0 0 2px rgba(99,102,241,0.25)' : 'none',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
        opacity: disabled ? 0.6 : 1, ...style,
      }}
      {...rest}
    />
  )
}
