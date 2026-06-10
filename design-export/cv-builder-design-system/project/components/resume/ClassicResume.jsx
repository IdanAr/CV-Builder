import React from 'react'
import { Sections, ContactLine, ALL_SECTIONS } from './resumeShared'

/* Classic — clean, single or two column, thin accent dividers under each
   section title. The CV Builder app's default template. */
export function ClassicResume({ data = {}, meta = {} }) {
  const m = {
    fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1f2937', accentColor: '#2563eb',
    pageMargins: 1.0, lineSpacing: 1.15, layout: 'single-column',
    sectionOrder: ALL_SECTIONS, columnAssignment: {}, ...meta,
  }
  const basics = data.basics ?? {}
  const pad = m.pageMargins * 96
  const order = m.sectionOrder?.length ? m.sectionOrder : ALL_SECTIONS

  const page = {
    fontFamily: `${m.fontFamily}, Arial, sans-serif`, fontSize: '11pt',
    lineHeight: m.lineSpacing, background: '#fff', color: '#000',
    width: '794px', minHeight: '1123px', padding: `${pad}px`, boxSizing: 'border-box',
  }
  const titleStyle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '13pt',
    fontWeight: 700, color: m.primaryColor,
    borderBottom: `1.5px solid ${m.primaryColor}`, paddingBottom: '2px',
    marginTop: '18px', marginBottom: '8px',
  }

  const header = (
    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
      <div style={{ fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '20pt', fontWeight: 700 }}>{basics.name}</div>
      {basics.label && <div style={{ fontSize: '12pt', color: '#555', marginTop: '2px' }}>{basics.label}</div>}
      <div style={{ fontSize: '10pt', marginTop: '4px' }}><ContactLine basics={basics} /></div>
    </div>
  )

  if (m.layout === 'two-column') {
    const ca = m.columnAssignment ?? {}
    const left = order.filter((s) => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'left')
    const right = order.filter((s) => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'right')
    return (
      <div style={page}>
        {header}
        {basics.summary && <div style={{ fontSize: '10pt', fontStyle: 'italic', marginBottom: '12px' }}>{basics.summary}</div>}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: '0 0 58%' }}><Sections data={data} order={left} titleStyle={titleStyle} accent={m.accentColor} /></div>
          <div style={{ flex: 1 }}><Sections data={data} order={right} titleStyle={titleStyle} accent={m.accentColor} /></div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      {header}
      {basics.summary && (
        <div>
          <div style={titleStyle}>Summary</div>
          <div style={{ fontSize: '10pt' }}>{basics.summary}</div>
        </div>
      )}
      <Sections data={data} order={order} titleStyle={titleStyle} accent={m.accentColor} />
    </div>
  )
}
