'use client'
import React from 'react'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'
import { richTextToHtml } from '@/lib/rich-text'
import { getColumnSide } from '@/lib/get-column-side'
import { formatDateRange } from '@/lib/format-date'

function rt(text: string | undefined | null): React.ReactNode {
  if (!text) return null
  return <span dangerouslySetInnerHTML={{ __html: richTextToHtml(text) }} />
}

const ALL_SECTIONS = ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']

export function ModernTemplate({ data, meta }: TemplateProps) {
  const { basics = {} } = data
  const pad = meta.pageMargins * 96
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
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`,
    fontSize: '12pt',
    fontWeight: 700,
    color: meta.accentColor,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginTop: '16px',
    marginBottom: '8px',
  }

  function renderSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      return renderCustomSection(cs, { sectionTitle, accentColor: meta.accentColor })
    }
    switch (section) {
      case 'work': {
        const work = data.work ?? []
        if (!work.length) return null
        return (
          <div key="work">
            <div style={sectionTitle}>Work Experience</div>
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
            <div style={sectionTitle}>Education</div>
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
      case 'skills': {
        const skills = data.skills ?? []
        if (!skills.length) return null
        return (
          <div key="skills">
            <div style={sectionTitle}>Skills</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.7 }}>
              {skills.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '2px' }}>
                  <div style={{ minWidth: '130px', fontWeight: 600, flexShrink: 0 }}>
                    {s.name}
                    {s.level && <span style={{ fontWeight: 400, color: '#666' }}> · {s.level}</span>}
                  </div>
                  {(s.keywords ?? []).length > 0 && (
                    <div style={{ color: '#444', flex: 1 }}>{(s.keywords ?? []).join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'languages': {
        const langs = data.languages ?? []
        if (!langs.length) return null
        return (
          <div key="languages">
            <div style={sectionTitle}>Languages</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.8 }}>
              {langs.map((l, i) => (
                <div key={i}>
                  <strong>{l.language}</strong>
                  {l.fluency && <span style={{ color: '#666' }}> - {l.fluency}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'volunteer': {
        const vol = data.volunteer ?? []
        if (!vol.length) return null
        return (
          <div key="volunteer">
            <div style={sectionTitle}>Volunteer</div>
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
      case 'certificates': {
        const certificates = data.certificates ?? []
        if (!certificates.length) return null
        return (
          <div key="certificates">
            <div style={sectionTitle}>Certifications</div>
            {certificates.map((c, i) => (
              <div key={i} style={{ marginBottom: '6px', fontSize: '10pt' }}>
                <strong>{c.name}</strong>
                {c.issuer && <span style={{ color: '#666' }}> — {c.issuer}</span>}
                {c.date && <span style={{ color: '#666' }}>  ·  {c.date}</span>}
              </div>
            ))}
          </div>
        )
      }
      case 'awards': {
        const awards = data.awards ?? []
        if (!awards.length) return null
        return (
          <div key="awards">
            <div style={sectionTitle}>Awards</div>
            {awards.map((a, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{a.title}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>{a.date}</span>
                </div>
                {a.awarder && <div style={{ fontSize: '10pt', color: '#666' }}>{a.awarder}</div>}
                {a.summary && <div style={{ fontSize: '10pt' }}>{a.summary}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'publications': {
        const publications = data.publications ?? []
        if (!publications.length) return null
        return (
          <div key="publications">
            <div style={sectionTitle}>Publications</div>
            {publications.map((p, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>{p.releaseDate}</span>
                </div>
                {p.publisher && <div style={{ fontSize: '10pt', color: '#666' }}>{p.publisher}</div>}
                {p.summary && <div style={{ fontSize: '10pt' }}>{p.summary}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'interests': {
        const interests = data.interests ?? []
        if (!interests.length) return null
        return (
          <div key="interests">
            <div style={sectionTitle}>Interests</div>
            <div style={{ fontSize: '10pt' }}>
              {interests.map((int, i) => (
                <React.Fragment key={i}>
                  <strong>{int.name}</strong>
                  {(int.keywords ?? []).length > 0 && <span style={{ color: '#555' }}>: {(int.keywords ?? []).join(', ')}</span>}
                  {i < interests.length - 1 && '  |  '}
                </React.Fragment>
              ))}
            </div>
          </div>
        )
      }
      case 'projects': {
        const projects = data.projects ?? []
        if (!projects.length) return null
        return (
          <div key="projects">
            <div style={sectionTitle}>Projects</div>
            {projects.map((p, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(p.startDate, p.endDate)}
                  </span>
                </div>
                {p.description && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{p.description}</div>}
                {(p.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                    {(p.highlights ?? []).map((h, hi) => <li key={hi}>{h}</li>)}
                  </ul>
                )}
                {(p.keywords ?? []).length > 0 && (
                  <div style={{ fontSize: '10pt', color: '#666', marginTop: '2px' }}>{(p.keywords ?? []).join(', ')}</div>
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

  const body = (
    <div style={{ padding: `${pad}px` }}>
      {basics.summary && (
        <div style={{ marginBottom: '12px', fontSize: '10pt', color: '#444' }}>{rt(basics.summary)}</div>
      )}
      {sectionOrder.map((s) => (
        <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
      ))}
    </div>
  )

  if (meta.layout === 'two-column') {
    const ca = meta.columnAssignment ?? {}
    const leftSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'left')
    const rightSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'right')
    return (
      <div style={page}>
        <div style={{ background: meta.primaryColor, color: '#fff', padding: `${pad}px ${pad}px ${pad * 0.75}px` }}>
          <div style={{ fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`, fontSize: '22pt', fontWeight: 700 }}>{basics.name}</div>
          {basics.label && <div style={{ fontSize: '12pt', opacity: 0.85, marginTop: '2px' }}>{basics.label}</div>}
          <div style={{ fontSize: '10pt', opacity: 0.75, marginTop: '4px' }}>
            {(() => {
              const eu = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`
              const parts: React.ReactNode[] = []
              if (basics.email) parts.push(<a key="em" href={`mailto:${basics.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{basics.email}</a>)
              if (basics.phone) parts.push(basics.phone)
              if (basics.url) parts.push(<a key="ul" href={eu(basics.url)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{basics.url}</a>)
              const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
              if (loc) parts.push(loc)
              return parts.flatMap((p, i) => i < parts.length - 1 ? [p, ' · '] : [p])
            })()}
          </div>
        </div>
        <div style={{ padding: `${pad}px` }}>
          {basics.summary && (
            <div style={{ marginBottom: '12px', fontSize: '10pt', color: '#444' }}>{rt(basics.summary)}</div>
          )}
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: '0 0 58%' }}>{leftSections.map((s) => (
              <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
            ))}</div>
            <div style={{ flex: 1 }}>{rightSections.map((s) => (
              <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
            ))}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={{ background: meta.primaryColor, color: '#fff', padding: `${pad}px ${pad}px ${pad * 0.75}px` }}>
        <div style={{ fontFamily: `${meta.headerFontFamily}, Arial, sans-serif`, fontSize: '22pt', fontWeight: 700 }}>{basics.name}</div>
        {basics.label && <div style={{ fontSize: '12pt', opacity: 0.85, marginTop: '2px' }}>{basics.label}</div>}
        <div style={{ fontSize: '10pt', opacity: 0.75, marginTop: '4px' }}>
          {[basics.email, basics.phone, [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
        </div>
      </div>
      {body}
    </div>
  )
}
