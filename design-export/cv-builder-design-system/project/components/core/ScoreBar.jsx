import React from 'react'

/* ATS score bar — fills green / yellow / red against thresholds. Used in the
   ATS panel breakdown and the dashboard format-score readout. */
export function ScoreBar({ value, max = 100, label, showValue = true }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0
  const color = pct >= 70 ? 'var(--green-500)' : pct >= 40 ? 'var(--yellow-500)' : 'var(--red-400)'
  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      {(label || showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-body)', marginBottom: '4px' }}>
          <span>{label}</span>
          {showValue && <span style={{ fontWeight: 500 }}>{value} / {max}</span>}
        </div>
      )}
      <div style={{ height: '8px', width: '100%', borderRadius: 'var(--radius-full)', background: 'var(--indigo-100)', overflow: 'hidden' }}>
        <div style={{ height: '8px', width: `${pct}%`, borderRadius: 'var(--radius-full)', background: color, transition: 'width var(--dur-slow) var(--ease-out)' }} />
      </div>
    </div>
  )
}
