import React from 'react'

/* Underline tab bar — the editor's Edit / Design / ATS switcher. */
export function Tabs({ tabs = [], active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-ui)' }}>
      {tabs.map((t) => {
        const id = typeof t === 'string' ? t : t.id
        const label = typeof t === 'string' ? t : t.label
        const on = id === active
        return (
          <button key={id} type="button" onClick={() => onChange && onChange(id)}
            style={{
              padding: '8px 16px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${on ? 'var(--brand-primary)' : 'transparent'}`,
              marginBottom: '-1px', color: on ? 'var(--brand-primary)' : 'var(--text-muted)',
              transition: 'color var(--dur-fast)',
            }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
