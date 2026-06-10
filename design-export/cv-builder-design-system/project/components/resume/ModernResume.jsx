import React from 'react'
import { Sections, ContactLine, ALL_SECTIONS } from './resumeShared'

/* Modern — bold full-width header block in the primary color with white text,
   uppercase letter-spaced accent section titles. */
export function ModernResume({ data = {}, meta = {} }) {
  const m = {
    fontFamily: 'Lato', headerFontFamily: 'Lato',
    primaryColor: '#4338ca', accentColor: '#6366f1',
    pageMargins: 1.0, lineSpacing: 1.15, layout: 'single-column',
    sectionOrder: ALL_SECTIONS, columnAssignment: {}, ...meta,
  }
  const basics = data.basics ?? {}
  const pad = m.pageMargins * 96
  const order = m.sectionOrder?.length ? m.sectionOrder : ALL_SECTIONS

  const page = {
    fontFamily: `${m.fontFamily}, Arial, sans-serif`, fontSize: '11pt',
    lineHeight: m.lineSpacing, background: '#fff', color: '#000',
    width: '794px', minHeight: '1123px', boxSizing: 'border-box',
  }
  const titleStyle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '12pt',
    fontWeight: 700, color: m.accentColor, textTransform: 'uppercase',
    letterSpacing: '0.08em', marginTop: '16px', marginBottom: '8px',
  }

  const banner = (
    <div style={{ background: m.primaryColor, color: '#fff', padding: `${pad}px ${pad}px ${pad * 0.75}px` }}>
      <div style={{ fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '22pt', fontWeight: 700 }}>{basics.name}</div>
      {basics.label && <div style={{ fontSize: '12pt', opacity: 0.85, marginTop: '2px' }}>{basics.label}</div>}
      <div style={{ fontSize: '10pt', opacity: 0.78, marginTop: '4px' }}><ContactLine basics={basics} /></div>
    </div>
  )

  if (m.layout === 'two-column') {
    const ca = m.columnAssignment ?? {}
    const left = order.filter((s) => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'left')
    const right = order.filter((s) => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'right')
    return (
      <div style={page}>
        {banner}
        <div style={{ padding: `${pad}px` }}>
          {basics.summary && <div style={{ marginBottom: '12px', fontSize: '10pt', color: '#444' }}>{basics.summary}</div>}
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: '0 0 58%' }}><Sections data={data} order={left} titleStyle={titleStyle} accent={m.accentColor} /></div>
            <div style={{ flex: 1 }}><Sections data={data} order={right} titleStyle={titleStyle} accent={m.accentColor} /></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      {banner}
      <div style={{ padding: `${pad}px` }}>
        {basics.summary && <div style={{ marginBottom: '12px', fontSize: '10pt', color: '#444' }}>{basics.summary}</div>}
        <Sections data={data} order={order} titleStyle={titleStyle} accent={m.accentColor} />
      </div>
    </div>
  )
}
