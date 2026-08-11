'use client'

import React from 'react'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'
import { getColumnSide } from '@/lib/get-column-side'
import { RichText } from './RichText'
import { formatDateRange, aggregateDateRange } from '@/lib/format-date'
import { webFontFamily } from '@/lib/fonts/families'
import { EXECUTIVE_TOKENS as T, px } from '@/lib/design/tokens'

function rt(text: string | undefined | null): React.ReactNode {
  return <RichText text={text} />
}

const ALL_SECTIONS = ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']

export function ExecutiveTemplate({ data, meta }: TemplateProps) {
  const { basics = {} } = data
  const pad = meta.pageMargins * 96
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : ALL_SECTIONS

  const page: React.CSSProperties = {
    fontFamily: webFontFamily(meta.fontFamily),
    fontSize: '11pt',
    lineHeight: meta.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    padding: `${pad}px`,
    boxSizing: 'border-box',
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: webFontFamily(meta.headerFontFamily),
    fontSize: `${T.sectionTitleSize}pt`,
    fontWeight: 700,
    color: meta.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    marginTop: px(T.sectionTitleMarginTop),
    marginBottom: px(T.sectionTitleMarginBottom),
    paddingBottom: '3px',
    borderBottom: `1px solid ${meta.primaryColor}`,
  }

  function renderSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      return renderCustomSection(cs, { sectionTitle, accentColor: meta.accentColor }, section)
    }
    switch (section) {
      case 'work': {
        const work = data.work ?? []
        if (!work.length) return null
        return (
          <div key="work" data-pv-section="work">
            <div style={sectionTitle}>Work Experience</div>
            {work.map((job, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.entryMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '11pt' }}>{job.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {aggregateDateRange([{ startDate: job.startDate, endDate: job.endDate }, ...(job.roles ?? [])], true)}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontStyle: 'italic', fontSize: '10.5pt' }}>{job.position}</div>
                {job.summary && <div style={{ fontSize: '10pt', marginTop: '3px', textAlign: 'justify' }}>{rt(job.summary)}</div>}
                {(job.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt' }}>
                    {(job.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
                  </ul>
                )}
                {(job.roles ?? []).map((role, ri) => (
                  <div key={role.id ?? ri} style={{ marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: meta.accentColor, fontStyle: 'italic', fontSize: '10.5pt' }}>{role.position}</span>
                      <span style={{ fontSize: '10pt', color: '#666' }}>
                        {formatDateRange(role.startDate, role.endDate, true)}
                      </span>
                    </div>
                    {role.summary && <div style={{ fontSize: '10pt', marginTop: '3px', textAlign: 'justify' }}>{rt(role.summary)}</div>}
                    {(role.highlights ?? []).length > 0 && (
                      <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt' }}>
                        {(role.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      }
      case 'education': {
        const education = data.education ?? []
        if (!education.length) return null
        return (
          <div key="education" data-pv-section="education">
            <div style={sectionTitle}>Education</div>
            {education.map((edu, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{edu.institution}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {aggregateDateRange([{ startDate: edu.startDate, endDate: edu.endDate }, ...(edu.roles ?? [])])}
                  </span>
                </div>
                <div style={{ fontSize: '10.5pt', fontStyle: 'italic' }}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</div>
                {edu.score && <div style={{ fontSize: '10pt', color: '#666' }}>Score: {edu.score}</div>}
                {(edu.roles ?? []).map((role, ri) => (
                  <div key={role.id ?? ri} style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '10.5pt', fontStyle: 'italic' }}>{[role.studyType, role.area].filter(Boolean).join(' in ')}</span>
                      <span style={{ fontSize: '10pt', color: '#666' }}>
                        {formatDateRange(role.startDate, role.endDate)}
                      </span>
                    </div>
                    {role.score && <div style={{ fontSize: '10pt', color: '#666' }}>Score: {role.score}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      }
      case 'skills': {
        const skills = data.skills ?? []
        if (!skills.length) return null
        return (
          <div key="skills" data-pv-section="skills">
            <div style={sectionTitle}>Skills</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.7 }}>
              {skills.map((s, i) => (
                <div key={i} data-pv-entry={i} style={{ display: 'flex', gap: '16px', marginBottom: '2px' }}>
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
          <div key="languages" data-pv-section="languages">
            <div style={sectionTitle}>Languages</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.8 }}>
              {langs.map((l, i) => (
                <div key={i} data-pv-entry={i}>
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
          <div key="volunteer" data-pv-section="volunteer">
            <div style={sectionTitle}>Volunteer</div>
            {vol.map((v, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{v.organization}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(v.startDate, v.endDate, true)}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontStyle: 'italic', fontSize: '10.5pt' }}>{v.position}</div>
                {v.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(v.summary)}</div>}
                {(v.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt' }}>
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
          <div key="certificates" data-pv-section="certificates">
            <div style={sectionTitle}>Certifications</div>
            {certificates.map((c, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: '6px', fontSize: '10pt' }}>
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
          <div key="awards" data-pv-section="awards">
            <div style={sectionTitle}>Awards</div>
            {awards.map((a, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{a.title}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>{a.date}</span>
                </div>
                {a.awarder && <div style={{ fontSize: '10pt', color: '#666' }}>{a.awarder}</div>}
                {a.summary && <div style={{ fontSize: '10pt', textAlign: 'justify' }}>{a.summary}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'publications': {
        const publications = data.publications ?? []
        if (!publications.length) return null
        return (
          <div key="publications" data-pv-section="publications">
            <div style={sectionTitle}>Publications</div>
            {publications.map((p, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>{p.releaseDate}</span>
                </div>
                {p.publisher && <div style={{ fontSize: '10pt', color: '#666' }}>{p.publisher}</div>}
                {p.summary && <div style={{ fontSize: '10pt', textAlign: 'justify' }}>{p.summary}</div>}
              </div>
            ))}
          </div>
        )
      }
      case 'interests': {
        const interests = data.interests ?? []
        if (!interests.length) return null
        return (
          <div key="interests" data-pv-section="interests">
            <div style={sectionTitle}>Interests</div>
            <div style={{ fontSize: '10pt' }}>
              {interests.map((int, i) => (
                <div key={i} data-pv-entry={i} style={{ display: 'inline' }}>
                  <strong>{int.name}</strong>
                  {(int.keywords ?? []).length > 0 && <span style={{ color: '#555' }}>: {(int.keywords ?? []).join(', ')}</span>}
                  {i < interests.length - 1 && '  |  '}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'projects': {
        const projects = data.projects ?? []
        if (!projects.length) return null
        return (
          <div key="projects" data-pv-section="projects">
            <div style={sectionTitle}>Projects</div>
            {projects.map((p, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.projectMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(p.startDate, p.endDate)}
                  </span>
                </div>
                {p.description && <div style={{ fontSize: '10pt', marginTop: '3px', textAlign: 'justify' }}>{p.description}</div>}
                {(p.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt' }}>
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

  const header = (
    <>
      {/* Header */}
      <div style={{ marginBottom: px(T.headerMarginBottom) }}>
        <div style={{
          fontFamily: webFontFamily(meta.headerFontFamily),
          fontSize: `${T.nameSize}pt`,
          fontWeight: 700,
          letterSpacing: '0.01em',
          color: meta.primaryColor,
        }}>
          {basics.name}
        </div>
        {basics.label && (
          <div style={{ fontSize: `${T.labelSize}pt`, color: meta.accentColor, fontStyle: 'italic', marginTop: '1px' }}>
            {basics.label}
          </div>
        )}
      </div>

      {/* Double rule */}
      <div style={{
        borderTop: `2px solid ${meta.primaryColor}`,
        borderBottom: `0.75px solid ${meta.primaryColor}`,
        height: '3px',
        margin: '6px 0 8px',
      }} />

      {/* Contact line */}
      <div style={{ fontSize: `${T.contactSize}pt`, color: '#555' }}>
        {(() => {
          const eu = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`
          const parts: React.ReactNode[] = []
          if (basics.email) parts.push(<a key="em" href={`mailto:${basics.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{basics.email}</a>)
          if (basics.phone) parts.push(basics.phone)
          for (const profile of basics.profiles ?? []) {
            if (!profile.url) continue
            parts.push(<a key={profile.id} href={eu(profile.url)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{profile.label || profile.url}</a>)
          }
          const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
          if (loc) parts.push(loc)
          return parts.flatMap((p, i) => i < parts.length - 1 ? [p, '   |   '] : [p])
        })()}
      </div>

      {/* Summary */}
      {basics.summary && (
        <div style={{ fontSize: '10.5pt', marginTop: px(T.summaryMarginBottom), textAlign: 'justify' }}>
          {rt(basics.summary)}
        </div>
      )}
    </>
  )

  if (meta.layout === 'two-column') {
    const ca = meta.columnAssignment ?? {}
    const leftSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'left')
    const rightSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'right')
    return (
      <div style={page}>
        {header}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: '0 0 58%' }}>{leftSections.map((s) => (
            <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
          ))}</div>
          <div style={{ flex: 1 }}>{rightSections.map((s) => (
            <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
          ))}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
      {header}
      {sectionOrder.map((s) => (
        <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
      ))}
    </div>
  )
}
