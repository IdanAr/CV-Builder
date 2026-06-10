import React from 'react'
import { Sections, ContactLine, ALL_SECTIONS } from './resumeShared'

/* Sidebar — fixed colored left rail (name, contact, skills, languages) beside a
   white main column (summary, work, education). Linear DOM order keeps it ATS-
   readable. New template added to the CV Builder set. */
export function SidebarResume({ data = {}, meta = {} }) {
  const m = {
    fontFamily: 'IBM Plex Sans', headerFontFamily: 'IBM Plex Sans',
    primaryColor: '#312e81', accentColor: '#6366f1',
    pageMargins: 1.0, lineSpacing: 1.15,
    sectionOrder: ALL_SECTIONS, ...meta,
  }
  const basics = data.basics ?? {}
  const pad = Math.max(m.pageMargins * 96 * 0.7, 34)
  const order = m.sectionOrder?.length ? m.sectionOrder : ALL_SECTIONS

  const page = {
    fontFamily: `${m.fontFamily}, Arial, sans-serif`, fontSize: '11pt',
    lineHeight: m.lineSpacing, background: '#fff', color: '#000',
    width: '794px', minHeight: '1123px', boxSizing: 'border-box',
    display: 'flex', alignItems: 'stretch',
  }
  const railTitle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '10pt',
    fontWeight: 700, color: '#fff', textTransform: 'uppercase',
    letterSpacing: '0.1em', marginTop: '18px', marginBottom: '7px',
    paddingBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.35)',
  }
  const mainTitle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '12pt',
    fontWeight: 700, color: m.primaryColor, textTransform: 'uppercase',
    letterSpacing: '0.06em', marginTop: '16px', marginBottom: '8px',
    paddingBottom: '2px', borderBottom: `2px solid ${m.accentColor}`,
  }

  const railSections = order.filter((s) => ['skills', 'languages'].includes(s))
  const mainSections = order.filter((s) => !['skills', 'languages'].includes(s))

  return (
    <div style={page}>
      {/* Left rail */}
      <div style={{ flex: '0 0 33%', background: m.primaryColor, color: '#fff', padding: `${pad}px`, boxSizing: 'border-box' }}>
        <div style={{ fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '18pt', fontWeight: 700, lineHeight: 1.1 }}>{basics.name}</div>
        {basics.label && <div style={{ fontSize: '10.5pt', opacity: 0.85, marginTop: '3px' }}>{basics.label}</div>}
        <div style={{ fontSize: '9pt', opacity: 0.9, marginTop: '12px', lineHeight: 1.9, wordBreak: 'break-word' }}>
          {[basics.email, basics.phone, basics.url, [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')]
            .filter(Boolean).map((p, i) => <div key={i}>{p}</div>)}
        </div>
        {railSections.includes('skills') && (data.skills ?? []).length > 0 && (
          <div>
            <div style={railTitle}>Skills</div>
            <div style={{ fontSize: '9.5pt', lineHeight: 1.6 }}>
              {(data.skills ?? []).map((s, i) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600 }}>{s.name}{s.level && <span style={{ fontWeight: 400, opacity: 0.8 }}> · {s.level}</span>}</div>
                  {(s.keywords ?? []).length > 0 && <div style={{ opacity: 0.85 }}>{s.keywords.join(', ')}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {railSections.includes('languages') && (data.languages ?? []).length > 0 && (
          <div>
            <div style={railTitle}>Languages</div>
            <div style={{ fontSize: '9.5pt', lineHeight: 1.7 }}>
              {(data.languages ?? []).map((l, i) => (
                <div key={i}><strong>{l.language}</strong>{l.fluency && <span style={{ opacity: 0.85 }}> – {l.fluency}</span>}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Main column */}
      <div style={{ flex: 1, padding: `${pad}px`, boxSizing: 'border-box' }}>
        {basics.summary && <div style={{ fontSize: '10pt', color: '#444', marginBottom: '6px' }}>{basics.summary}</div>}
        <Sections data={data} order={mainSections} titleStyle={mainTitle} accent={m.accentColor} />
      </div>
    </div>
  )
}
