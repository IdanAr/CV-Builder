'use client'
import type { TemplateProps } from './ClassicTemplate'
import { renderCustomSection } from './renderCustomSection'

const ALL_SECTIONS = ['work', 'education', 'skills', 'volunteer', 'languages']

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
                    {[job.startDate, job.endDate || 'Present'].filter(Boolean).join(' – ')}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{job.position}</div>
                {job.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{job.summary}</div>}
                {(job.highlights ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                    {(job.highlights ?? []).map((h, hi) => <li key={hi}>{h}</li>)}
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
                    {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
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
            <div style={{ fontSize: '10pt', lineHeight: 1.6 }}>
              {skills.map((s, i) => (
                <span key={i}>
                  <strong>{s.name}</strong>
                  {s.level && <span style={{ color: '#666' }}> ({s.level})</span>}
                  {(s.keywords ?? []).length > 0 && <span style={{ color: '#555' }}>: {(s.keywords ?? []).join(', ')}</span>}
                  {i < skills.length - 1 && <span style={{ margin: '0 8px', color: '#ccc' }}>|</span>}
                </span>
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
                <span key={i}>
                  <strong>{l.language}</strong>
                  {l.fluency && <span style={{ color: '#666' }}> ({l.fluency})</span>}
                  {i < langs.length - 1 && <span style={{ margin: '0 8px' }}>·</span>}
                </span>
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
                    {[v.startDate, v.endDate || 'Present'].filter(Boolean).join(' – ')}
                  </span>
                </div>
                <div style={{ color: meta.accentColor, fontWeight: 500, fontSize: '10.5pt' }}>{v.position}</div>
                {v.summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{v.summary}</div>}
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
        <div style={{ marginBottom: '12px', fontSize: '10pt', color: '#444' }}>{basics.summary}</div>
      )}
      {sectionOrder.map(renderSection)}
    </div>
  )

  if (meta.layout === 'two-column') {
    const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer'].includes(s) || s.startsWith('custom:'))
    const rightSections = sectionOrder.filter((s) => !leftSections.includes(s))
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
        <div style={{ padding: `${pad}px`, display: 'flex', gap: '24px' }}>
          <div style={{ flex: '0 0 58%' }}>{leftSections.map(renderSection)}</div>
          <div style={{ flex: 1 }}>{rightSections.map(renderSection)}</div>
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
