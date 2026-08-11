import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import {
  mapToPdfFont, inToPt, resolveSectionOrder, pdfDocumentProps,
  renderPdfRichText, renderPdfRichTextRuns,
} from './pdf-utils'
import { renderPdfCustomSection } from './renderPdfCustomSection'
import { formatDate, formatDateRange, aggregateDateRange } from '@/lib/format-date'
import { withLineHeights, sectionReserve, entryReserve } from './pdf-primitives'
import { resolveProfiles } from '@/lib/basics-profiles'

const PAGE_FONT_SIZE = 10.5

/**
 * Shared ATS-safe renderer used by every template in "ats" export mode.
 * Strictly linear single column: no flex rows, no backgrounds, no
 * light-on-dark text. The template's visual identity is reduced to its
 * fonts and heading color.
 */
export function AtsPdfTemplate({ data, meta, title }: { data: ResumeData; meta: ResumeMeta; title?: string }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  // Hard ATS floors: margins never below 0.5in, line spacing clamped to 1.0–1.15
  const margin = inToPt(Math.max(meta.pageMargins, 0.5))
  const lineHeight = Math.min(Math.max(meta.lineSpacing, 1.0), 1.15)
  const sectionOrder = resolveSectionOrder(meta)
  const SECTION_RESERVE = sectionReserve(PAGE_FONT_SIZE, lineHeight)
  const ENTRY_RESERVE = entryReserve(PAGE_FONT_SIZE, lineHeight)

  const styles = withLineHeights(StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: PAGE_FONT_SIZE, lineHeight, color: '#000000', padding: margin },
    name: { fontFamily: headFont, fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
    label: { fontSize: 11, color: '#333333', marginBottom: 2 },
    contact: { fontSize: 10, color: '#333333', marginBottom: 6 },
    sectionTitle: {
      fontFamily: headFont, fontSize: 13, fontWeight: 'bold', color: meta.primaryColor,
      marginTop: 10, marginBottom: 4,
    },
    entryHead: { fontSize: 10.5, fontWeight: 'bold', marginTop: 5 },
    dates: { fontWeight: 'normal', color: '#333333' },
    position: { fontSize: 10.5, color: '#333333' },
    body: { fontSize: 10.5, marginTop: 1 },
    bullet: { fontSize: 10.5, marginLeft: 12, marginBottom: 1 },
    small: { fontSize: 10, color: '#333333' },
  }), lineHeight)

  const contactLine = [
    basics.email, basics.phone,
    ...resolveProfiles(basics).filter((p) => p.url).map((p) => (p.label ? `${p.label}: ${p.url}` : p.url)),
    [basics.location?.city, basics.location?.region].filter(Boolean).join(', '),
  ].filter(Boolean).join(' | ')

  // Single text line per entry head — never a flex row, so Y-order parsers
  // can't split name and dates across columns.
  const entryHead = (name: string, dates: string) => (
    <Text style={styles.entryHead}>
      {name}
      {dates ? <Text style={styles.dates}> | {dates}</Text> : null}
    </Text>
  )

  function renderSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      // Built-in ATS headings are literal uppercase; mirror that for custom sections
      // entryRow deliberately has no flexDirection: title and dates stack vertically
      return renderPdfCustomSection({ ...cs, name: cs.name.toUpperCase() }, {
        sectionTitle: styles.sectionTitle,
        entryRow: { marginBottom: 2 },
        bold: { fontSize: 10.5, fontWeight: 'bold' },
        accent: styles.position,
        small: styles.small,
        body: styles.body,
        bullet: styles.bullet,
        link: { fontSize: 10, color: '#333333' },
        keywords: { fontSize: 10, color: '#333333', marginTop: 2 },
        level: { fontSize: 10, color: '#333333' },
      })
    }
    switch (section) {
      case 'work':
        if (!work.length) return null
        return (
          <View key="work">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>WORK EXPERIENCE</Text>
            </View>
            {work.map((job, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  {entryHead(job.name ?? '', aggregateDateRange([{ startDate: job.startDate, endDate: job.endDate }, ...(job.roles ?? [])], true))}
                  {job.position ? <Text style={styles.position}>{job.position}</Text> : null}
                </View>
                {renderPdfRichText(job.summary, styles.body)}
                {(job.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))}
                {(job.roles ?? []).map((role, ri) => (
                  <View key={role.id ?? ri} wrap={false} minPresenceAhead={ENTRY_RESERVE} style={{ marginTop: 3 }}>
                    {entryHead(role.position ?? '', formatDateRange(role.startDate, role.endDate, true))}
                    {renderPdfRichText(role.summary, styles.body)}
                    {(role.highlights ?? []).map((h, hi) => (
                      <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )
      case 'education':
        if (!education.length) return null
        return (
          <View key="education">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>EDUCATION</Text>
            </View>
            {education.map((edu, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  {entryHead(edu.institution ?? '', aggregateDateRange([{ startDate: edu.startDate, endDate: edu.endDate }, ...(edu.roles ?? [])]))}
                  <Text style={styles.body}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
                </View>
                {edu.score ? <Text style={styles.small}>Score: {edu.score}</Text> : null}
                {(edu.roles ?? []).map((role, ri) => (
                  <View key={role.id ?? ri} wrap={false} minPresenceAhead={ENTRY_RESERVE} style={{ marginTop: 2 }}>
                    {entryHead([role.studyType, role.area].filter(Boolean).join(' in '), formatDateRange(role.startDate, role.endDate))}
                    {role.score ? <Text style={styles.small}>Score: {role.score}</Text> : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )
      case 'skills':
        if (!skills.length) return null
        return (
          <View key="skills">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>SKILLS</Text>
            </View>
            {skills.map((s, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{s.name ?? ''}</Text>
                {s.level ? ` (${s.level})` : ''}
                {(s.keywords ?? []).length > 0 ? `: ${(s.keywords ?? []).join(', ')}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'certificates':
        if (!certificates.length) return null
        return (
          <View key="certificates">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>CERTIFICATIONS</Text>
            </View>
            {certificates.map((c, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{c.name ?? ''}</Text>
                {c.issuer ? ` - ${c.issuer}` : ''}
                {c.date ? ` | ${formatDate(c.date)}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'languages':
        if (!languages.length) return null
        return (
          <View key="languages">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>LANGUAGES</Text>
            </View>
            {languages.map((l, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{l.language ?? ''}</Text>
                {l.fluency ? ` - ${l.fluency}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'awards':
        if (!awards.length) return null
        return (
          <View key="awards">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>AWARDS</Text>
            </View>
            {awards.map((a, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  {entryHead(a.title ?? '', a.date ? formatDate(a.date) : '')}
                  {a.awarder ? <Text style={styles.small}>{a.awarder}</Text> : null}
                </View>
                {a.summary ? <Text style={styles.body}>{a.summary}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'publications':
        if (!publications.length) return null
        return (
          <View key="publications">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>PUBLICATIONS</Text>
            </View>
            {publications.map((p, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  {entryHead(p.name ?? '', p.releaseDate ? formatDate(p.releaseDate) : '')}
                  {p.publisher ? <Text style={styles.small}>{p.publisher}</Text> : null}
                </View>
                {p.summary ? <Text style={styles.body}>{p.summary}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'volunteer':
        if (!volunteer.length) return null
        return (
          <View key="volunteer">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>VOLUNTEER</Text>
            </View>
            {volunteer.map((v, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  {entryHead(v.organization ?? '', formatDateRange(v.startDate, v.endDate, true))}
                  {v.position ? <Text style={styles.position}>{v.position}</Text> : null}
                </View>
                {renderPdfRichText(v.summary, styles.body)}
                {(v.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))}
              </View>
            ))}
          </View>
        )
      case 'interests':
        if (!interests.length) return null
        return (
          <View key="interests">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>INTERESTS</Text>
            </View>
            {interests.map((int, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 'bold' }}>{int.name ?? ''}</Text>
                {(int.keywords ?? []).length > 0 ? `: ${(int.keywords ?? []).join(', ')}` : ''}
              </Text>
            ))}
          </View>
        )
      case 'projects':
        if (!projects.length) return null
        return (
          <View key="projects">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>PROJECTS</Text>
            </View>
            {projects.map((p, i) => (
              <View key={i} style={{ marginBottom: 5 }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  {entryHead(p.name ?? '', formatDateRange(p.startDate, p.endDate))}
                </View>
                {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
                {(p.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))}
                {(p.keywords ?? []).length > 0 ? <Text style={styles.small}>{(p.keywords ?? []).join(', ')}</Text> : null}
              </View>
            ))}
          </View>
        )
      default:
        return null
    }
  }

  return (
    <Document {...pdfDocumentProps(data, title)}>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.label}>{basics.label}</Text> : null}
          {contactLine ? <Text style={styles.contact}>{contactLine}</Text> : null}
          {renderPdfRichText(basics.summary, styles.body)}
          {sectionOrder.map(renderSection)}
        </View>
      </Page>
    </Document>
  )
}
