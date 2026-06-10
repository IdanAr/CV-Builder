import React from 'react'

/* Primary action button for the CV Builder app chrome. Indigo fill by default,
   with outline / ghost / danger variants and two sizes. */
export function Button({ variant = 'primary', size = 'md', disabled = false, type = 'button', onClick, children, style = {}, ...rest }) {
  const sizes = {
    sm: { padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-md)' },
    md: { padding: '8px 16px', fontSize: '14px', borderRadius: 'var(--radius-lg)' },
    lg: { padding: '12px 22px', fontSize: '15px', borderRadius: 'var(--radius-lg)' },
  }
  const variants = {
    primary: { background: 'var(--brand-primary)', color: '#fff', border: '1px solid transparent' },
    secondary: { background: 'var(--surface-solid)', color: 'var(--brand-primary)', border: '1px solid var(--border-default)' },
    ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' },
    danger: { background: 'var(--surface-solid)', color: 'var(--red-600)', border: '1px solid var(--red-400)' },
  }
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    fontFamily: 'var(--font-ui)', fontWeight: 500, lineHeight: 1.2,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    transition: 'background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast)',
    whiteSpace: 'nowrap', ...sizes[size], ...variants[variant], ...style,
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={base}
      onMouseEnter={(e) => { if (!disabled && variant === 'primary') e.currentTarget.style.background = 'var(--brand-primary-hover)'
        else if (!disabled && variant !== 'ghost') e.currentTarget.style.background = 'var(--indigo-50)'
        else if (!disabled) e.currentTarget.style.background = 'var(--indigo-50)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = variants[variant].background }}
      {...rest}>
      {children}
    </button>
  )
}
