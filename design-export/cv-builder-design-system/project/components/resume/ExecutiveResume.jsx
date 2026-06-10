import React from 'react'
import { Sections, ContactLine, ALL_SECTIONS } from './resumeShared'

/* Executive — serif, left-aligned, restrained. A large name over a thin double
   rule, small-caps section titles. Reads as senior / traditional industries.
   New template added to the CV Builder set. */
export function ExecutiveResume({ data = {}, meta = {} }) {
  const m = {
    fontFamily: 'Georgia', headerFontFamily: 'Georgia',
    primaryColor: '#1a1a1a', accentColor: '#7c3aed',
    pageMargins: 1.0, lineSpacing: 1.15,
    sectionOrder: ALL_SECTIONS, ...meta,
  }
  const basics = data.basics ?? {}
  const pad = m.pageMargins * 96
  const order = m.sectionOrder?.length ? m.sectionOrder : ALL_SECTIONS

  const page = {
    fontFamily: `${m.fontFamily}, 'Times New Roman', serif`, fontSize: '11pt',
    lineHeight: m.lineSpacing, background: '#fff', color: '#000',
    width: '794px', minHeight: '1123px', padding: `${pad}px`, boxSizing: 'border-box',
  }
  const titleStyle = {
    fontFamily: `${m.headerFontFamily}, serif`, fontSize: '11.5pt',
    fontWeight: 700, color: m.primaryColor, textTransform: 'uppercase',
    letterSpacing: '0.14em', marginTop: '18px', marginBottom: '7px',
    paddingBottom: '3px', borderBottom: `1px solid #ccc`,
  }

  return (
    <div style={page}>
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontFamily: `${m.headerFontFamily}, serif`, fontSize: '26pt', fontWeight: 700, letterSpacing: '0.01em', color: m.primaryColor }}>
          {basics.name}
        </div>
        {basics.label && (
          <div style={{ fontSize: '12pt', color: m.accentColor, fontStyle: 'italic', marginTop: '1px' }}>{basics.label}</div>
        )}
      </div>
      <div style={{ borderTop: `2px solid ${m.primaryColor}`, borderBottom: `0.75px solid ${m.primaryColor}`, height: '3px', margin: '6px 0 8px' }} />
      <div style={{ fontSize: '10pt' }}><ContactLine basics={basics} sep="   |   " /></div>
      {basics.summary && (
        <div style={{ fontSize: '10.5pt', marginTop: '12px', textAlign: 'justify' }}>{basics.summary}</div>
      )}
      <Sections data={data} order={order} titleStyle={titleStyle} accent={m.accentColor} />
    </div>
  )
}
