import type { CSSProperties } from 'react'
import type { CustomSection, CustomSectionItem } from '@/lib/schemas/resume.zod'
import { RichText } from './RichText'
import { formatDateRange } from '@/lib/format-date'
import { resolveCustomSectionRoles } from '@/lib/roles'
import { pts, resolveFontScale } from '@/lib/design/font-scale'

function rt(text: string | undefined | null): React.ReactNode {
  return <RichText text={text} />
}

interface RenderStyles {
  sectionTitle: CSSProperties
  accentColor: string
  fontScale?: number
}

type Sz = (pt: number) => string

function renderFlatItem(item: CustomSectionItem, enabledFields: CustomSection['enabledFields'], accentColor: string, sz: Sz): React.ReactNode {
  return (
    <>
      {enabledFields.includes('subtitle') && item.subtitle && (
        <div style={{ color: accentColor, fontWeight: 500, fontSize: sz(10.5) }}>
          {item.subtitle}
        </div>
      )}
      {enabledFields.includes('url') && item.url && (
        <div style={{ fontSize: sz(9), color: '#666' }}>
          <a href={/^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`}
             target="_blank" rel="noopener noreferrer"
             style={{ color: '#0066cc' }}>{item.url}</a>
        </div>
      )}
      {enabledFields.includes('summary') && item.summary && (
        <div style={{ fontSize: sz(10), marginTop: '3px' }}>{rt(item.summary)}</div>
      )}
      {enabledFields.includes('highlights') && (item.highlights ?? []).length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: sz(10), listStyleType: 'disc' }}>
          {(item.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
        </ul>
      )}
      {enabledFields.includes('keywords') && (item.keywords ?? []).length > 0 && (
        <div style={{ fontSize: sz(9), color: '#555', marginTop: '3px' }}>
          {(item.keywords ?? []).join(' · ')}
        </div>
      )}
      {enabledFields.includes('level') && item.level && (
        <div style={{ fontSize: sz(9), color: '#555' }}>Level: {item.level}</div>
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
  const sz: Sz = (pt) => pts(pt, resolveFontScale({ fontScale: styles.fontScale }))

  return (
    <div data-pv-section={sectionKey}>
      <div style={styles.sectionTitle}>{name}</div>
      {items.map((item, i) => {
        const roles = hasRoles ? resolveCustomSectionRoles(item) : []
        return (
          <div key={item.id || i} data-pv-entry={i} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              {item.title && <strong style={{ fontSize: sz(11) }}>{item.title}</strong>}
              {!hasRoles && enabledFields.includes('dateRange') && (item.startDate || item.endDate) && (
                <span style={{ fontSize: sz(10), color: '#666' }}>{formatDateRange(item.startDate, item.endDate)}</span>
              )}
            </div>
            {hasRoles && enabledFields.includes('url') && item.url && (
              <div style={{ fontSize: sz(9), color: '#666' }}>
                <a href={/^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`}
                   target="_blank" rel="noopener noreferrer"
                   style={{ color: '#0066cc' }}>{item.url}</a>
              </div>
            )}
            {hasRoles ? (
              roles.map((role, ri) => (
                <div key={role.id ?? ri} style={{ marginTop: ri === 0 ? 0 : '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    {role.title && <span style={{ color: styles.accentColor, fontWeight: 500, fontSize: sz(10.5) }}>{role.title}</span>}
                    {(role.startDate || role.endDate) && (
                      <span style={{ fontSize: sz(10), color: '#666' }}>{formatDateRange(role.startDate, role.endDate)}</span>
                    )}
                  </div>
                  {enabledFields.includes('subtitle') && role.subtitle && (
                    <div style={{ fontSize: sz(10), color: '#555' }}>{role.subtitle}</div>
                  )}
                  {enabledFields.includes('summary') && role.summary && (
                    <div style={{ fontSize: sz(10), marginTop: '3px' }}>{rt(role.summary)}</div>
                  )}
                  {enabledFields.includes('highlights') && (role.highlights ?? []).length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: sz(10), listStyleType: 'disc' }}>
                      {(role.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
                    </ul>
                  )}
                  {enabledFields.includes('keywords') && (role.keywords ?? []).length > 0 && (
                    <div style={{ fontSize: sz(9), color: '#555', marginTop: '3px' }}>
                      {(role.keywords ?? []).join(' · ')}
                    </div>
                  )}
                  {enabledFields.includes('level') && role.level && (
                    <div style={{ fontSize: sz(9), color: '#555' }}>Level: {role.level}</div>
                  )}
                </div>
              ))
            ) : (
              renderFlatItem(item, enabledFields, styles.accentColor, sz)
            )}
          </div>
        )
      })}
    </div>
  )
}
