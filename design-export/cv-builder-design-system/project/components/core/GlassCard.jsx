import React from 'react'

/* Frosted glass surface — the signature container of the app. Wraps cards,
   panels, modals. Defaults to the standard 65%-white blur card. */
export function GlassCard({ as = 'div', elevation = 'lg', padding = 16, children, style = {}, ...rest }) {
  const Tag = as
  const shadows = { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)', xl: 'var(--shadow-xl)' }
  return (
    <Tag
      style={{
        background: 'var(--surface-card)',
        backdropFilter: 'blur(var(--blur-glass))', WebkitBackdropFilter: 'blur(var(--blur-glass))',
        border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xl)',
        boxShadow: shadows[elevation], padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
