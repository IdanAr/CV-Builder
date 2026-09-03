'use client'

import React from 'react'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'
import { RichText } from './RichText'
import { formatDateRange } from '@/lib/format-date'
import { resolveProfiles } from '@/lib/basics-profiles'
import { resolveWorkRoles, resolveEducationRoles } from '@/lib/roles'
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
    // Deliberately distinct from the main column's T.sectionTitleMarginTop
    // (12pt/16px) — see the "differently-sized section title" comment on
    // that token in lib/design/tokens.ts: the rail's own title uses 13.5pt
    // (18px), with no slot in the shared token shape for a second size.
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

  // Every section the rail can render, keyed the same way as renderMainSection
  // so the two are exhaustive over the same set. Before this, the rail was a
  // fixed run of `railSections.includes('skills') && ...` blocks covering seven
  // sections, which had two consequences: assigning work, education, volunteer
  // or a custom section to the rail made it vanish from the document entirely
  // (the rail could not draw it and the main column had already filtered it
  // out), and the rail ignored sectionOrder, drawing in source order however
  // the user had dragged things. The PDF's rail has always handled all eleven
  // and mapped over sectionOrder, so the preview was also lying about the
  // export. Rail copy is white-on-primaryColor, so muted text uses opacity
  // rather than the grey and accent colours the main column uses.
  function renderRailSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs || !cs.items.length) return null
      return (
        <div key={section} data-pv-section={section}>
          <div style={railTitleStyle}>{cs.name}</div>
          <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
            {cs.items.map((item, i) => (
              <div key={item.id ?? i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
                {item.title && <div style={{ fontWeight: 600 }}>{item.title}</div>}
                {cs.enabledFields.includes('subtitle') && item.subtitle && (
                  <div style={{ opacity: 0.9 }}>{item.subtitle}</div>
                )}
                {cs.enabledFields.includes('dateRange') && formatDateRange(item.startDate, item.endDate) && (
                  <div style={{ opacity: 0.85 }}>{formatDateRange(item.startDate, item.endDate)}</div>
                )}
                {cs.enabledFields.includes('summary') && item.summary && (
                  <div style={{ opacity: 0.9, marginTop: '2px' }}>{rt(item.summary)}</div>
                )}
                {cs.enabledFields.includes('highlights') && (item.highlights ?? []).map((h, hi) => (
                  <div key={hi} style={{ opacity: 0.9 }}>• {rt(h)}</div>
                ))}
                {cs.enabledFields.includes('keywords') && (item.keywords ?? []).length > 0 && (
                  <div style={{ opacity: 0.85 }}>{(item.keywords ?? []).join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }
    switch (section) {
      case 'work': {
        const work = data.work ?? []
        if (!work.length) return null
        return (
          <div key="work" data-pv-section="work">
            <div style={railTitleStyle}>Work Experience</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {work.map((job, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600 }}>{job.name}</div>
                  {resolveWorkRoles(job).map((role, ri) => (
                    <div key={role.id ?? ri} style={{ marginTop: ri === 0 ? '2px' : '5px' }}>
                      <div style={{ fontWeight: 600, opacity: 0.95 }}>
                        {role.position}
                        {formatDateRange(role.startDate, role.endDate) && (
                          <span style={{ fontWeight: 400, opacity: 0.8 }}> · {formatDateRange(role.startDate, role.endDate)}</span>
                        )}
                      </div>
                      {role.summary && <div style={{ opacity: 0.9, marginTop: '2px' }}>{rt(role.summary)}</div>}
                      {(role.highlights ?? []).map((h, hi) => (
                        <div key={hi} style={{ opacity: 0.9 }}>• {rt(h)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'education': {
        const education = data.education ?? []
        if (!education.length) return null
        return (
          <div key="education" data-pv-section="education">
            <div style={railTitleStyle}>Education</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {education.map((edu, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600 }}>{edu.institution}</div>
                  {resolveEducationRoles(edu).map((role, ri) => (
                    <div key={role.id ?? ri} style={{ opacity: 0.9 }}>
                      {[role.studyType, role.area].filter(Boolean).join(' in ')}
                      {formatDateRange(role.startDate, role.endDate) && (
                        <span style={{ opacity: 0.85 }}> · {formatDateRange(role.startDate, role.endDate)}</span>
                      )}
                      {role.score && <div style={{ opacity: 0.85 }}>Score: {role.score}</div>}
                    </div>
                  ))}
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
            <div style={railTitleStyle}>Volunteer</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {vol.map((v, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600 }}>{v.organization}</div>
                  {v.position && <div style={{ opacity: 0.9 }}>{v.position}</div>}
                  {formatDateRange(v.startDate, v.endDate) && (
                    <div style={{ opacity: 0.85 }}>{formatDateRange(v.startDate, v.endDate)}</div>
                  )}
                  {v.summary && <div style={{ opacity: 0.9, marginTop: '2px' }}>{rt(v.summary)}</div>}
                  {(v.highlights ?? []).map((h, hi) => (
                    <div key={hi} style={{ opacity: 0.9 }}>• {rt(h)}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'skills': {
        if ((data.skills ?? []).length === 0) return null
        return (
          <div key="skills" data-pv-section="skills">
            <div style={railTitleStyle}>Skills</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.skills ?? []).map((s, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
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
        )
      }
      case 'languages': {
        if ((data.languages ?? []).length === 0) return null
        return (
          <div key="languages" data-pv-section="languages">
            <div style={railTitleStyle}>Languages</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.7 }}>
              {(data.languages ?? []).map((l, i) => (
                <div key={i} data-pv-entry={i}>
                  <strong>{l.language}</strong>
                  {l.fluency && <span style={{ opacity: 0.85 }}> - {l.fluency}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'certificates': {
        if ((data.certificates ?? []).length === 0) return null
        return (
          <div key="certificates" data-pv-section="certificates">
            <div style={railTitleStyle}>Certifications</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.certificates ?? []).map((c, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
                  <strong>{c.name}</strong>
                  {c.issuer && <span style={{ opacity: 0.85 }}> - {c.issuer}</span>}
                  {c.date && <span style={{ opacity: 0.8 }}>  ·  {c.date}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'awards': {
        if ((data.awards ?? []).length === 0) return null
        return (
          <div key="awards" data-pv-section="awards">
            <div style={railTitleStyle}>Awards</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.awards ?? []).map((a, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
                  <strong>{a.title}</strong>
                  {a.date && <span style={{ opacity: 0.8 }}>  ·  {a.date}</span>}
                  {a.awarder && <div style={{ opacity: 0.85 }}>{a.awarder}</div>}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'publications': {
        if ((data.publications ?? []).length === 0) return null
        return (
          <div key="publications" data-pv-section="publications">
            <div style={railTitleStyle}>Publications</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.publications ?? []).map((p, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
                  <strong>{p.name}</strong>
                  {p.releaseDate && <span style={{ opacity: 0.8 }}>  ·  {p.releaseDate}</span>}
                  {p.publisher && <div style={{ opacity: 0.85 }}>{p.publisher}</div>}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'interests': {
        if ((data.interests ?? []).length === 0) return null
        return (
          <div key="interests" data-pv-section="interests">
            <div style={railTitleStyle}>Interests</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.interests ?? []).map((int, i) => (
                <div key={i} data-pv-entry={i}>
                  <strong>{int.name}</strong>
                  {(int.keywords ?? []).length > 0 && <span style={{ opacity: 0.85 }}>: {(int.keywords ?? []).join(', ')}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 'projects': {
        if ((data.projects ?? []).length === 0) return null
        return (
          <div key="projects" data-pv-section="projects">
            <div style={railTitleStyle}>Projects</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {(data.projects ?? []).map((p, i) => (
                <div key={i} data-pv-entry={i} style={{ marginBottom: '6px' }}>
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
        )
      }
      default:
        return null
    }
  }

  function renderMainSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      return renderCustomSection(cs, { sectionTitle: mainTitleStyle, accentColor: meta.accentColor }, section)
    }
    switch (section) {
      case 'work': {
        const work = data.work ?? []
        if (!work.length) return null
        return (
          <div key="work" data-pv-section="work">
            <div style={mainTitleStyle}>Work Experience</div>
            {work.map((job, i) => {
              const roles = resolveWorkRoles(job)
              return (
                <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.entryMarginBottom) }}>
                  <strong style={{ fontSize: '11pt' }}>{job.name}</strong>
                  {roles.map((role, ri) => (
                    <div key={role.id ?? ri} style={{ marginTop: ri === 0 ? 0 : '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{role.position}</span>
                        <span style={{ fontSize: '10pt', color: '#666' }}>
                          {formatDateRange(role.startDate, role.endDate)}
                        </span>
                      </div>
                      {role.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(role.summary)}</div>}
                      {(role.highlights ?? []).length > 0 && (
                        <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt', listStyleType: 'disc' }}>
                          {(role.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )
      }
      case 'education': {
        const education = data.education ?? []
        if (!education.length) return null
        return (
          <div key="education" data-pv-section="education">
            <div style={mainTitleStyle}>Education</div>
            {education.map((edu, i) => {
              const roles = resolveEducationRoles(edu)
              return (
                <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
                  <strong>{edu.institution}</strong>
                  {roles.map((role, ri) => (
                    <div key={role.id ?? ri} style={{ marginTop: ri === 0 ? 0 : '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '10.5pt' }}>{[role.studyType, role.area].filter(Boolean).join(' in ')}</span>
                        <span style={{ fontSize: '10pt', color: '#666' }}>
                          {formatDateRange(role.startDate, role.endDate)}
                        </span>
                      </div>
                      {role.score && <div style={{ fontSize: '10pt', color: '#666' }}>Score: {role.score}</div>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )
      }
      case 'volunteer': {
        const vol = data.volunteer ?? []
        if (!vol.length) return null
        return (
          <div key="volunteer" data-pv-section="volunteer">
            <div style={mainTitleStyle}>Volunteer</div>
            {vol.map((v, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{v.organization}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(v.startDate, v.endDate)}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{v.position}</div>
                {v.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(v.summary)}</div>}
                {(v.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt', listStyleType: 'disc' }}>
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
            <div style={mainTitleStyle}>Certifications</div>
            {certificates.map((c, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: '6px', fontSize: '10pt' }}>
                <strong>{c.name}</strong>
                {c.issuer && <span style={{ color: '#666' }}> - {c.issuer}</span>}
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
            <div style={mainTitleStyle}>Awards</div>
            {awards.map((a, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
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
          <div key="publications" data-pv-section="publications">
            <div style={mainTitleStyle}>Publications</div>
            {publications.map((p, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.eduMarginBottom) }}>
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
          <div key="interests" data-pv-section="interests">
            <div style={mainTitleStyle}>Interests</div>
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
            <div style={mainTitleStyle}>Projects</div>
            {projects.map((p, i) => (
              <div key={i} data-pv-entry={i} style={{ marginBottom: px(T.projectMarginBottom) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: '10pt', color: '#666' }}>
                    {formatDateRange(p.startDate, p.endDate)}
                  </span>
                </div>
                {p.description && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{rt(p.description)}</div>}
                {(p.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: px(T.bulletIndent), fontSize: '10pt', listStyleType: 'disc' }}>
                    {(p.highlights ?? []).map((h, hi) => <li key={hi}>{rt(h)}</li>)}
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
      case 'skills': {
        const skills = data.skills ?? []
        if (!skills.length) return null
        return (
          <div key="skills" data-pv-section="skills">
            <div style={mainTitleStyle}>Skills</div>
            <div style={{ fontSize: '10pt', lineHeight: 1.7 }}>
              {skills.map((s, i) => (
                <div key={i} data-pv-entry={i} style={{ display: 'flex', gap: '16px', marginBottom: '2px' }}>
                  <div style={{ minWidth: '130px', fontWeight: 600 }}>
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
            <div style={mainTitleStyle}>Languages</div>
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
      default:
        return null
    }
  }

  return (
    <div style={page}>
      {/* Left rail */}
      <div style={{
        flex: `0 0 ${meta.sidebarRailWidth ?? 33}%`,
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
          {basics.email && <div>{basics.email}</div>}
          {basics.phone && <div>{basics.phone}</div>}
          {resolveProfiles(basics).filter((p) => p.url).map((p) => {
            const eu = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`
            return (
              <div key={p.id}>
                <a href={eu(p.url!)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {p.label || p.url}
                </a>
              </div>
            )
          })}
          {[basics.location?.city, basics.location?.region].filter(Boolean).join(', ') && (
            <div>{[basics.location?.city, basics.location?.region].filter(Boolean).join(', ')}</div>
          )}
        </div>

        {railSections.map((s) => (
          <React.Fragment key={s}>{renderRailSection(s)}</React.Fragment>
        ))}
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
