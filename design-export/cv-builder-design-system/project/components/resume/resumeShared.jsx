import React from 'react'

/* Shared rendering pieces for the CV templates.
   Every template draws the same section bodies (work / education / skills /
   languages / volunteer) and differs only in its section-title style, header
   block, and layout. These helpers keep the templates thin and consistent.
   Mirrors the JSON-Resume schema used by the CV Builder app. */

export function fmtDate(d) {
  if (!d) return ''
  const m = /^(\d{4})-(\d{2})/.exec(d)
  if (m) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(m[2], 10) - 1]} ${m[1]}`
  }
  return d
}

function range(a, b, present) {
  const parts = [fmtDate(a), fmtDate(b) || (present ? 'Present' : '')].filter(Boolean)
  return parts.join(' – ')
}

export function ContactLine({ basics = {}, color = '#555', sep = ' · ' }) {
  const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  const parts = [basics.email, basics.phone, basics.url, loc].filter(Boolean)
  return (
    <span style={{ color }}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>{p}{i < parts.length - 1 ? sep : ''}</React.Fragment>
      ))}
    </span>
  )
}

function Entry({ title, org, date, role, summary, highlights, accent }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
        <strong style={{ fontSize: '11pt', flex: 1, minWidth: 0 }}>{title}</strong>
        <span style={{ fontSize: '10pt', color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>{date}</span>
      </div>
      {role && <div style={{ color: accent, fontWeight: 500, fontSize: '10.5pt' }}>{role}</div>}
      {summary && <div style={{ fontSize: '10pt', marginTop: '3px' }}>{summary}</div>}
      {(highlights ?? []).length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
          {highlights.map((h, i) => <li key={i} style={{ marginBottom: '2px' }}>{h}</li>)}
        </ul>
      )}
    </div>
  )
}

/* Renders one section body (no title). `kind` selects the shape. */
export function SectionBody({ kind, data, accent }) {
  switch (kind) {
    case 'work':
      return (data.work ?? []).map((j, i) => (
        <Entry key={i} title={j.name} role={j.position} accent={accent}
          date={range(j.startDate, j.endDate, true)} summary={j.summary} highlights={j.highlights} />
      ))
    case 'volunteer':
      return (data.volunteer ?? []).map((v, i) => (
        <Entry key={i} title={v.organization} role={v.position} accent={accent}
          date={range(v.startDate, v.endDate, true)} summary={v.summary} highlights={v.highlights} />
      ))
    case 'education':
      return (data.education ?? []).map((e, i) => (
        <div key={i} style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
            <strong style={{ flex: 1, minWidth: 0 }}>{e.institution}</strong>
            <span style={{ fontSize: '10pt', color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>{range(e.startDate, e.endDate)}</span>
          </div>
          <div style={{ fontSize: '10.5pt' }}>{[e.studyType, e.area].filter(Boolean).join(' in ')}</div>
          {e.score && <div style={{ fontSize: '10pt', color: '#666' }}>Score: {e.score}</div>}
        </div>
      ))
    case 'skills':
      return (
        <div style={{ fontSize: '10pt', lineHeight: 1.7 }}>
          {(data.skills ?? []).map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '2px' }}>
              <div style={{ minWidth: '130px', fontWeight: 600, flexShrink: 0 }}>
                {s.name}{s.level && <span style={{ fontWeight: 400, color: '#666' }}> · {s.level}</span>}
              </div>
              {(s.keywords ?? []).length > 0 && <div style={{ color: '#444', flex: 1 }}>{s.keywords.join(', ')}</div>}
            </div>
          ))}
        </div>
      )
    case 'languages':
      return (
        <div style={{ fontSize: '10pt', lineHeight: 1.8 }}>
          {(data.languages ?? []).map((l, i) => (
            <div key={i}><strong>{l.language}</strong>{l.fluency && <span style={{ color: '#666' }}> – {l.fluency}</span>}</div>
          ))}
        </div>
      )
    default:
      return null
  }
}

const SECTION_TITLES = {
  work: 'Work Experience', education: 'Education', skills: 'Skills',
  volunteer: 'Volunteer', languages: 'Languages',
}

export function sectionLabel(key) { return SECTION_TITLES[key] ?? key }

/* Maps the meta.sectionOrder into <title + body> blocks using the
   template's own titleStyle. hasContent() lets templates hide empties. */
export function Sections({ data, order, titleStyle, accent, only }) {
  const keys = (order && order.length ? order : ['work', 'education', 'skills', 'volunteer', 'languages'])
    .filter((k) => !only || only.includes(k))
  return keys.map((key) => {
    const arr = data[key]
    if (!arr || arr.length === 0) return null
    return (
      <div key={key}>
        <div style={titleStyle}>{sectionLabel(key)}</div>
        <SectionBody kind={key} data={data} accent={accent} />
      </div>
    )
  })
}

export const ALL_SECTIONS = ['work', 'education', 'skills', 'volunteer', 'languages']
