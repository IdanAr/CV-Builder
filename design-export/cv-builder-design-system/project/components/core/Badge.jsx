import React from 'react'

/* Small pill label. Used for keyword chips (matched / missing), template tags,
   and status markers throughout the app. */
export function Badge({ variant = 'neutral', children, style = {} }) {
  const variants = {
    neutral: { background: 'var(--indigo-50)', color: 'var(--indigo-700)', border: '1px solid var(--indigo-100)' },
    matched: { background: '#dcfce7', color: 'var(--green-600)', border: '1px solid #bbf7d0' },
    missing: { background: '#fee2e2', color: 'var(--red-600)', border: '1px solid #fecaca' },
    info: { background: 'var(--indigo-100)', color: 'var(--indigo-700)', border: '1px solid var(--indigo-200)' },
    warn: { background: '#fef9c3', color: 'var(--yellow-600)', border: '1px solid #fef08a' },
    solid: { background: 'var(--brand-primary)', color: '#fff', border: '1px solid transparent' },
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 500, lineHeight: 1.4,
      padding: '2px 8px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
      ...variants[variant], ...style,
    }}>
      {children}
    </span>
  )
}
