import React from 'react'

/* CV Builder brand mark — the violet hexagon network node with a star,
   optionally followed by the gradient wordmark. */
export function Logo({ size = 40, showWordmark = true, wordmark = 'CV Builder' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-ui)' }}>
      <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="CV Builder logo">
        <defs>
          <linearGradient id="cvbLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient id="cvbLogoLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" /><stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <polygon points="50,25 65,35 65,55 50,65 35,55 35,35" fill="url(#cvbLogoGrad)" />
        {[[30,30],[70,30],[20,50],[80,50],[30,70],[70,70]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="4" fill="url(#cvbLogoLight)" />
        ))}
        {[[30,30,42,38],[70,30,58,38],[20,50,35,45],[80,50,65,45],[30,70,42,58],[70,70,58,58]].map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#A78BFA" strokeWidth="2" opacity="0.6" />
        ))}
        <path d="M 42 42 L 48 42 L 50 38 L 52 42 L 58 42 L 54 48 L 56 54 L 50 50 L 44 54 L 46 48 Z" fill="#FFFFFF" opacity="0.9" />
      </svg>
      {showWordmark && (
        <span style={{
          fontSize: Math.round(size * 0.45), fontWeight: 700, whiteSpace: 'nowrap',
          background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text',
          backgroundClip: 'text', color: 'transparent',
        }}>
          {wordmark}
        </span>
      )}
    </span>
  )
}
