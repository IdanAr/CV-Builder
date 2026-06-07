import type { CSSProperties } from 'react'
import type { CustomSection } from '@/lib/schemas/resume.zod'

interface RenderStyles {
  sectionTitle: CSSProperties
  accentColor: string
}

export function renderCustomSection(
  section: CustomSection,
  styles: RenderStyles
): React.ReactNode {
  const { name, enabledFields, items } = section
  if (!items.length) return null

  return (
    <div>
      <div style={styles.sectionTitle}>{name}</div>
      {items.map((item, i) => (
        <div key={item.id || i} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            {item.title && <strong style={{ fontSize: '11pt' }}>{item.title}</strong>}
            {enabledFields.includes('dateRange') && (item.startDate || item.endDate) && (
              <span style={{ fontSize: '10pt', color: '#666' }}>
                {[item.startDate, item.endDate].filter(Boolean).join(' – ')}
              </span>
            )}
          </div>
          {enabledFields.includes('subtitle') && item.subtitle && (
            <div style={{ color: styles.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>
              {item.subtitle}
            </div>
          )}
          {enabledFields.includes('url') && item.url && (
            <div style={{ fontSize: '9pt', color: '#666' }}>
              <a href={item.url}>{item.url}</a>
            </div>
          )}
          {enabledFields.includes('summary') && item.summary && (
            <div style={{ fontSize: '10pt', marginTop: '3px' }}>{item.summary}</div>
          )}
          {enabledFields.includes('highlights') && (item.highlights ?? []).length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
              {(item.highlights ?? []).map((h, hi) => <li key={hi}>{h}</li>)}
            </ul>
          )}
          {enabledFields.includes('keywords') && (item.keywords ?? []).length > 0 && (
            <div style={{ fontSize: '9pt', color: '#555', marginTop: '3px' }}>
              {(item.keywords ?? []).join(' · ')}
            </div>
          )}
          {enabledFields.includes('level') && item.level && (
            <div style={{ fontSize: '9pt', color: '#555' }}>Level: {item.level}</div>
          )}
        </div>
      ))}
    </div>
  )
}
