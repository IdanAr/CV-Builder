import type { CSSProperties } from 'react'
import type { CustomSection } from '@/lib/schemas/resume.zod'
import { richTextToHtml } from '@/lib/rich-text'
import { formatDateRange } from '@/lib/format-date'

function rt(text: string | undefined | null): React.ReactNode {
  if (!text) return null
  return <span dangerouslySetInnerHTML={{ __html: richTextToHtml(text) }} />
}

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
                {formatDateRange(item.startDate, item.endDate)}
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
              <a href={/^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ color: '#0066cc' }}>{item.url}</a>
            </div>
          )}
          {enabledFields.includes('summary') && item.summary && (
            <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(item.summary)}</div>
          )}
          {enabledFields.includes('highlights') && (item.highlights ?? []).length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
              {(item.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
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
