import type { CSSProperties } from 'react'
import type { CustomSection, CustomSectionItem } from '@/lib/schemas/resume.zod'
import { RichText } from './RichText'
import { formatDateRange } from '@/lib/format-date'
import { resolveCustomSectionRoles } from '@/lib/roles'

function rt(text: string | undefined | null): React.ReactNode {
  return <RichText text={text} />
}

interface RenderStyles {
  sectionTitle: CSSProperties
  accentColor: string
}

function renderFlatItem(item: CustomSectionItem, enabledFields: CustomSection['enabledFields'], accentColor: string): React.ReactNode {
  return (
    <>
      {enabledFields.includes('subtitle') && item.subtitle && (
        <div style={{ color: accentColor, fontWeight: 500, fontSize: '10.5pt' }}>
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
    </>
  )
}

export function renderCustomSection(
  section: CustomSection,
  styles: RenderStyles,
  sectionKey: string
): React.ReactNode {
  const { name, enabledFields, items } = section
  if (!items.length) return null
  const hasRoles = enabledFields.includes('roles')

  return (
    <div data-pv-section={sectionKey}>
      <div style={styles.sectionTitle}>{name}</div>
      {items.map((item, i) => {
        const roles = hasRoles ? resolveCustomSectionRoles(item) : []
        return (
          <div key={item.id || i} data-pv-entry={i} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              {item.title && <strong style={{ fontSize: '11pt' }}>{item.title}</strong>}
              {!hasRoles && enabledFields.includes('dateRange') && (item.startDate || item.endDate) && (
                <span style={{ fontSize: '10pt', color: '#666' }}>{formatDateRange(item.startDate, item.endDate)}</span>
              )}
            </div>
            {hasRoles && enabledFields.includes('url') && item.url && (
              <div style={{ fontSize: '9pt', color: '#666' }}>
                <a href={/^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`}
                   target="_blank" rel="noopener noreferrer"
                   style={{ color: '#0066cc' }}>{item.url}</a>
              </div>
            )}
            {hasRoles ? (
              roles.map((role, ri) => (
                <div key={role.id ?? ri} style={{ marginTop: ri === 0 ? 0 : '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    {role.title && <span style={{ color: styles.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{role.title}</span>}
                    {(role.startDate || role.endDate) && (
                      <span style={{ fontSize: '10pt', color: '#666' }}>{formatDateRange(role.startDate, role.endDate)}</span>
                    )}
                  </div>
                  {enabledFields.includes('subtitle') && role.subtitle && (
                    <div style={{ fontSize: '10pt', color: '#555' }}>{role.subtitle}</div>
                  )}
                  {enabledFields.includes('summary') && role.summary && (
                    <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(role.summary)}</div>
                  )}
                  {enabledFields.includes('highlights') && (role.highlights ?? []).length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                      {(role.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
                    </ul>
                  )}
                  {enabledFields.includes('keywords') && (role.keywords ?? []).length > 0 && (
                    <div style={{ fontSize: '9pt', color: '#555', marginTop: '3px' }}>
                      {(role.keywords ?? []).join(' · ')}
                    </div>
                  )}
                  {enabledFields.includes('level') && role.level && (
                    <div style={{ fontSize: '9pt', color: '#555' }}>Level: {role.level}</div>
                  )}
                </div>
              ))
            ) : (
              renderFlatItem(item, enabledFields, styles.accentColor)
            )}
          </div>
        )
      })}
    </div>
  )
}
