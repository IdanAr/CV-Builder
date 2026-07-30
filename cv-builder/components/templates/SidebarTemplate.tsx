'use client'

import React from 'react'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'
import { RichText } from './RichText'
import { formatDateRange } from '@/lib/format-date'
import { webFontFamily } from '@/lib/fonts/families'
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
import { SIDEBAR_TOKENS as T, px } from '@/lib/design/tokens'

function rt(text: string | undefined | null): React.ReactNode {
  return <RichText text={text} />
}

const ALL_SECTIONS = ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']

export function SidebarTemplate({ data, meta }: TemplateProps) {
  const { basics = {} } = data
  const pad = Math.max(meta.pageMargins * 96 * 0.7, 48)
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : ALL_SECTIONS

  const page: React.CSSProperties = {
    fontFamily: webFontFamily(meta.fontFamily),
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
    fontFamily: webFontFamily(meta.headerFontFamily),
    fontSize: '12pt',
    fontWeight: 700,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginTop: '18px',
    marginBottom: '7px',
    paddingBottom: '3px',
    borderBottom: `1px solid ${meta.accentColor}`,
  }

  const mainTitleStyle: React.CSSProperties = {
    fontFamily: webFontFamily(meta.headerFontFamily),
    fontSize: `${T.sectionTitleSize}pt`,
    fontWeight: 700,
    color: meta.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: px(T.sectionTitleMarginTop),
    marginBottom: px(T.sectionTitleMarginBottom),
    paddingBottom: '2px',
    borderBottom: `2px solid ${meta.accentColor}`,
  }

  const ca = meta.columnAssignment ?? {}
  const railSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'left')
  const mainSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'right')

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
              <div key={i} style={{ marginBottom: px(T.entryMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '11pt' }}>{job.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(job.startDate, job.endDate, true)}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{job.position}</div>
                {job.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(job.summary)}</div>}
                {(job.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt' }}>
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
              <div key={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
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
              <div key={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{v.organization}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(v.startDate, v.endDate, true)}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{v.position}</div>
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
          <div key="certificates">
            <div style={mainTitleStyle}>Certifications</div>
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
            <div style={mainTitleStyle}>Awards</div>
            {awards.map((a, i) => (
              <div key={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
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
            <div style={mainTitleStyle}>Publications</div>
            {publications.map((p, i) => (
              <div key={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
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
            <div style={mainTitleStyle}>Interests</div>
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
            <div style={mainTitleStyle}>Projects</div>
            {projects.map((p, i) => (
              <div key={i} style={{ marginBottom: px(T.projectMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(p.startDate, p.endDate)}
                  </span>
                </div>
                {p.description && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{p.description}</div>}
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
          fontFamily: webFontFamily(meta.headerFontFamily),
          fontSize: `${T.nameSize}pt`,
          fontWeight: 700,
          lineHeight: 1.1,
        }}>
          {basics.name}
        </div>
        {basics.label && (
          <div style={{ fontSize: `${T.labelSize}pt`, opacity: 0.85, marginTop: '3px' }}>{basics.label}</div>
        )}
        <div style={{ fontSize: `${T.contactSize}pt`, opacity: 0.9, marginTop: '12px', lineHeight: 1.9, wordBreak: 'break-word' }}>
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
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
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
            <div style={{ fontSize: '10pt', lineHeight: 1.7 }}>
              {(data.languages ?? []).map((l, i) => (
                <div key={i}>
                  <strong>{l.language}</strong>
                  {l.fluency && <span style={{ opacity: 0.85 }}> - {l.fluency}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rail: certificates */}
        {railSections.includes('certificates') && (data.certificates ?? []).length > 0 && (
          <div>
            <div style={railTitleStyle}>Certifications</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.certificates ?? []).map((c, i) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <strong>{c.name}</strong>
                  {c.issuer && <span style={{ opacity: 0.85 }}> — {c.issuer}</span>}
                  {c.date && <span style={{ opacity: 0.8 }}>  ·  {c.date}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rail: awards */}
        {railSections.includes('awards') && (data.awards ?? []).length > 0 && (
          <div>
            <div style={railTitleStyle}>Awards</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.awards ?? []).map((a, i) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <strong>{a.title}</strong>
                  {a.date && <span style={{ opacity: 0.8 }}>  ·  {a.date}</span>}
                  {a.awarder && <div style={{ opacity: 0.85 }}>{a.awarder}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rail: publications */}
        {railSections.includes('publications') && (data.publications ?? []).length > 0 && (
          <div>
            <div style={railTitleStyle}>Publications</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.publications ?? []).map((p, i) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <strong>{p.name}</strong>
                  {p.releaseDate && <span style={{ opacity: 0.8 }}>  ·  {p.releaseDate}</span>}
                  {p.publisher && <div style={{ opacity: 0.85 }}>{p.publisher}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rail: interests */}
        {railSections.includes('interests') && (data.interests ?? []).length > 0 && (
          <div>
            <div style={railTitleStyle}>Interests</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.interests ?? []).map((int, i) => (
                <div key={i}>
                  <strong>{int.name}</strong>
                  {(int.keywords ?? []).length > 0 && <span style={{ opacity: 0.85 }}>: {(int.keywords ?? []).join(', ')}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rail: projects */}
        {railSections.includes('projects') && (data.projects ?? []).length > 0 && (
          <div>
            <div style={railTitleStyle}>Projects</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.projects ?? []).map((p, i) => (
                <div key={i} style={{ marginBottom: '6px' }}>
                  <strong>{p.name}</strong>
                  {formatDateRange(p.startDate, p.endDate) && (
                    <span style={{ opacity: 0.8 }}>  ·  {formatDateRange(p.startDate, p.endDate)}</span>
                  )}
                  {p.description && <div style={{ opacity: 0.9 }}>{p.description}</div>}
                  {(p.highlights ?? []).map((h, hi) => <div key={hi} style={{ opacity: 0.9 }}>• {h}</div>)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main column */}
      <div style={{ flex: 1, padding: `${pad}px`, boxSizing: 'border-box' }}>
        {basics.summary && (
          <div style={{ fontSize: '10pt', color: '#444', marginBottom: px(T.summaryMarginBottom) }}>{rt(basics.summary)}</div>
        )}
        {mainSections.map((s) => (
          <React.Fragment key={s}>{renderMainSection(s)}</React.Fragment>
        ))}
      </div>
    </div>
  )
}
