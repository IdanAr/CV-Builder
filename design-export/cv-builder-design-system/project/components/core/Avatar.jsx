import React from 'react'

/* Gradient initials avatar (falls back from a photo). Matches the profile pill
   and dropdown header in the app. */
export function Avatar({ name, image, size = 32 }) {
  const initials = (name || '?').split(' ').filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('')
  if (image) {
    return <img src={image} alt={name || 'User'} width={size} height={size} style={{ borderRadius: 'var(--radius-full)', objectFit: 'cover' }} />
  }
  return (
    <div style={{
      width: size, height: size, flexShrink: 0, borderRadius: 'var(--radius-full)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--brand-gradient-br)', color: '#fff',
      fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: Math.floor(size * 0.42),
    }}>
      {initials}
    </div>
  )
}
