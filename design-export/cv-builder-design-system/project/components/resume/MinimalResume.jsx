import React from 'react'
import { Sections, ContactLine, ALL_SECTIONS } from './resumeShared'

/* Minimal — typography only. Centered name, small uppercase letter-spaced grey
   labels, no rules or color blocks. Maximum ATS compatibility. */
export function MinimalResume({ data = {}, meta = {} }) {
  const m = {
    fontFamily: 'Georgia', headerFontFamily: 'Georgia',
    primaryColor: '#333333', accentColor: '#444444',
    pageMargins: 1.0, lineSpacing: 1.15,
    sectionOrder: ALL_SECTIONS, ...meta,
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
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '10pt',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
    color: '#333', marginTop: '20px', marginBottom: '8px',
  }

  return (
    <div style={page}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontFamily: `${m.headerFontFamily}, Arial, sans-serif`, fontSize: '22pt', fontWeight: 700, letterSpacing: '-0.02em' }}>{basics.name}</div>
        {basics.label && <div style={{ fontSize: '11pt', color: '#555', marginTop: '3px' }}>{basics.label}</div>}
        <div style={{ fontSize: '10pt', color: '#777', marginTop: '4px' }}><ContactLine basics={basics} sep="  ·  " /></div>
      </div>
      {basics.summary && <div style={{ fontSize: '10pt', color: '#444', marginBottom: '16px' }}>{basics.summary}</div>}
      <Sections data={data} order={order} titleStyle={titleStyle} accent={m.accentColor} />
    </div>
  )
}
