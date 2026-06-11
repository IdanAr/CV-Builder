'use client'

import React from 'react'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'
import { richTextToHtml } from '@/lib/rich-text'
import { formatDateRange } from '@/lib/format-date'

function rt(text: string | undefined | null): React.ReactNode {
  if (!text) return null
  return <span dangerouslySetInnerHTML={{ __html: richTextToHtml(text) }} />
}

const ALL_SECTIONS = ['work', 'education', 'skills', 'volunteer', 'languages']

// Sections that belong in the sidebar rail
const RAIL_SECTIONS = new Set(['skills', 'languages'])

export function SidebarTemplate({ data, meta }: TemplateProps) {
  const { basics = {} } = data
  const pad = Math.max(meta.pageMargins * 96 * 0.7, 34)
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : ALL_SECTIONS

  const page: React.CSSProperties = {
    fontFamily: `${meta.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: meta.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'stretch',
  }

  const railTitleStyle: React.CSSProperties = {
    fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`,
    fontSize: '10pt',
    fontWeight: 700,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginTop: '18px',
    marginBottom: '7px',
    paddingBottom: '3px',
    borderBottom: '1px solid rgba(255,255,255,0.35)',
  }

  const mainTitleStyle: React.CSSProperties = {
    fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`,
    fontSize: '12pt',
    fontWeight: 700,
    color: meta.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: '16px',
    marginBottom: '8px',
    paddingBottom: '2px',
    borderBottom: `2px solid ${meta.accentColor}`,
  }

  const railSections = sectionOrder.filter((s) => !s.startsWith('custom:') && RAIL_SECTIONS.has(s))
  const mainSections = sectionOrder.filter((s) => s.startsWith('custom:') || !RAIL_SECTIONS.has(s))

  function renderMainSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      return renderCustomSection(cs, { sectionTitle: mainTitleStyle, accentColor: meta.accentColor })
    }
    switch (section) {
      case 'work': {
        const work = data.work ?? []
        if (!work.length) return null
        return (
          <div key="work">
            <div style={mainTitleStyle}>Work Experience</div>
            {work.map((job, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '11pt' }}>{job.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(job.startDate, job.endDate, true)}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{job.position}</div>
                {job.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(job.summary)}</div>}
                {(job.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                    {(job.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )
      }
      case 'education': {
        const education = data.education ?? []
        if (!education.length) return null
        return (
          <div key="education">
            <div style={mainTitleStyle}>Education</div>
            {education.map((edu, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{edu.institution}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(edu.startDate, edu.endDate)}
                  </span>
                </div>
                <div style={{ fontSize: '10.5pt' }}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</div>
                {edu.score && <div style={{ fontSize: '10pt', color: '#666' }}>Score: {edu.score}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'volunteer': {
        const vol = data.volunteer ?? []
        if (!vol.length) return null
        return (
          <div key="volunteer">
            <div style={mainTitleStyle}>Volunteer</div>
            {vol.map((v, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{v.organization}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(v.startDate, v.endDate, true)}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{v.position}</div>
                {v.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(v.summary)}</div>}
                {(v.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                    {(v.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )
      }
      default:
        return null
    }
  }

  return (
    <div style={page}>
      {/* Left rail */}
      <div style={{
        flex: '0 0 33%',
        background: meta.primaryColor,
        color: '#fff',
        padding: `${pad}px`,
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`,
          fontSize: '18pt',
          fontWeight: 700,
          lineHeight: 1.1,
        }}>
          {basics.name}
        </div>
        {basics.label && (
          <div style={{ fontSize: '10.5pt', opacity: 0.85, marginTop: '3px' }}>{basics.label}</div>
        )}
        <div style={{ fontSize: '9pt', opacity: 0.9, marginTop: '12px', lineHeight: 1.9, wordBreak: 'break-word' }}>
          {[
            basics.email,
            basics.phone,
            basics.url,
            [basics.location?.city, basics.location?.region].filter(Boolean).join(', '),
          ].filter(Boolean).map((p, i) => <div key={i}>{p}</div>)}
        </div>

        {/* Rail: skills */}
        {railSections.includes('skills') && (data.skills ?? []).length > 0 && (
          <div>
            <div style={railTitleStyle}>Skills</div>
            <div style={{ fontSize: '9.5pt', lineHeight: 1.6 }}>
              {(data.skills ?? []).map((s, i) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600 }}>
                    {s.name}
                    {s.level && <span style={{ fontWeight: 400, opacity: 0.8 }}> · {s.level}</span>}
                  </div>
                  {(s.keywords ?? []).length > 0 && (
                    <div style={{ opacity: 0.85 }}>{(s.keywords ?? []).join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rail: languages */}
        {railSections.includes('languages') && (data.languages ?? []).length > 0 && (
          <div>
            <div style={railTitleStyle}>Languages</div>
            <div style={{ fontSize: '9.5pt', lineHeight: 1.7 }}>
              {(data.languages ?? []).map((l, i) => (
                <div key={i}>
                  <strong>{l.language}</strong>
                  {l.fluency && <span style={{ opacity: 0.85 }}> – {l.fluency}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main column */}
      <div style={{ flex: 1, padding: `${pad}px`, boxSizing: 'border-box' }}>
        {basics.summary && (
          <div style={{ fontSize: '10pt', color: '#444', marginBottom: '6px' }}>{rt(basics.summary)}</div>
        )}
        {mainSections.map((s) => (
          <React.Fragment key={s}>{renderMainSection(s)}</React.Fragment>
        ))}
      </div>
    </div>
  )
}
