import React from 'react'
import { Document, Page, View, Text, StyleSheet, Link } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, resolveSectionOrder, ensureHttps, renderPdfRichText, renderPdfRichTextRuns, pdfDocumentProps } from './pdf-utils'
import { renderPdfCustomSection } from './renderPdfCustomSection'
import { getColumnSide } from '@/lib/get-column-side'
import { formatDateRange } from '@/lib/format-date'

export function ExecutivePdfTemplate({ data, meta, title }: { data: ResumeData; meta: ResumeMeta; title?: string }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(meta.pageMargins)
  const sectionOrder = resolveSectionOrder(meta)

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: meta.lineSpacing, padding: margin, color: '#000000' },
    name: { fontFamily: headFont, fontSize: 26, fontWeight: 'bold', color: meta.primaryColor, letterSpacing: 0.25 },
    subtitle: { fontSize: 12, color: meta.accentColor, fontStyle: 'italic', marginTop: 0.75 },
    // Web double rule: 2px top + 0.75px bottom with 3px between, 6px above / 8px below
    ruleThick: { borderTopWidth: 1.5, borderTopColor: meta.primaryColor, marginTop: 4.5, marginBottom: 2.25 },
    ruleThin: { borderTopWidth: 0.55, borderTopColor: meta.primaryColor, marginBottom: 6 },
    sectionTitle: {
      fontFamily: headFont, fontSize: 11.5, fontWeight: 'bold', color: meta.primaryColor,
      textTransform: 'uppercase', letterSpacing: 1.6,
      borderBottomWidth: 0.75, borderBottomColor: meta.primaryColor,
      paddingBottom: 2.25, marginTop: 13.5, marginBottom: 5.25,
    },
    bold: { fontWeight: 'bold' },
    accent: { color: meta.accentColor, fontStyle: 'italic', fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: 13.5, marginBottom: 1 },
    bulletFirst: { marginTop: 3 },
    body: { fontSize: 10, textAlign: 'justify' },
    entrySummary: { fontSize: 10, marginTop: 2, textAlign: 'justify' },
    plainSummary: { fontSize: 10, marginTop: 2 },
    degree: { fontSize: 10.5, fontStyle: 'italic' },
    summary: { fontSize: 10.5, textAlign: 'justify', marginTop: 9 },
  })

  function buildContactRow() {
    const items: Array<{ label: string; href: string }> = []
    if (basics.email) items.push({ label: basics.email, href: `mailto:${basics.email}` })
    if (basics.phone) items.push({ label: basics.phone, href: '' })
    if (basics.url) items.push({ label: basics.url, href: ensureHttps(basics.url) })
    const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
    if (loc) items.push({ label: loc, href: '' })
    if (!items.length) return null
    return (
      <Text style={{ fontSize: 10, color: '#555555' }}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {item.href
              ? <Link src={item.href} style={{ textDecoration: 'none' }}><Text style={{ color: '#555555' }}>{item.label}</Text></Link>
              : <Text style={{ color: '#555555' }}>{item.label}</Text>
            }
            {i < items.length - 1 && <Text style={{ color: '#555555' }}>{'   |   '}</Text>}
          </React.Fragment>
        ))}
      </Text>
    )
  }

  function renderPdfSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      return renderPdfCustomSection(cs, { sectionTitle: styles.sectionTitle, bold: styles.bold, accent: styles.accent, small: styles.small, body: styles.plainSummary, bullet: styles.bullet })
    }
    switch (section) {
      case 'work':
        if (!work.length) return null
        return (
          <View key="work">
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {work.map((job, i) => {
              const dates = formatDateRange(job.startDate, job.endDate, true)
              return (
                <View key={i} style={{ marginBottom: 7.5 }}>
                  <Text style={{ marginBottom: 2 }}>
                    <Text style={styles.bold}>{job.name ?? ''}</Text>
                    {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
                  </Text>
                  <Text style={styles.accent}>{job.position ?? ''}</Text>
                  {renderPdfRichText(job.summary, styles.entrySummary)}
                  {(job.highlights ?? []).map((h, hi) => (
                    <Text key={hi} style={hi === 0 ? [styles.bullet, styles.bulletFirst] : styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                  ))}
                </View>
              )
            })}
          </View>
        )
      case 'education':
        if (!education.length) return null
        return (
          <View key="education">
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, i) => {
              const dates = formatDateRange(edu.startDate, edu.endDate)
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={{ marginBottom: 2 }}>
                    <Text style={styles.bold}>{edu.institution ?? ''}</Text>
                    {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
                  </Text>
                  <Text style={styles.degree}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
                  {edu.score ? <Text style={styles.small}>Score: {edu.score}</Text> : null}
                </View>
              )
            })}
          </View>
        )
      case 'skills':
        if (!skills.length) return null
        return (
          <View key="skills">
            <Text style={styles.sectionTitle}>Skills</Text>
            {/* Mirrors the web definition list: fixed-width bold name column, keywords fill the rest */}
            {skills.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 1.5 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', minWidth: 97.5 }}>
                  {s.name ?? ''}
                  {s.level ? <Text style={{ fontWeight: 'normal', color: '#666666' }}> · {s.level}</Text> : null}
                </Text>
                {(s.keywords ?? []).length > 0 ? <Text style={{ fontSize: 10, color: '#444444', flex: 1 }}>{(s.keywords ?? []).join(', ')}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'certificates':
        if (!certificates.length) return null
        return (
          <View key="certificates">
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certificates.map((c, i) => (
              <Text key={i} style={{ marginBottom: 4 }}>
                <Text style={styles.bold}>
                  {c.name ?? ''}
                  {c.issuer ? <Text style={styles.small}> — {c.issuer}</Text> : null}
                </Text>
                {c.date ? <Text style={styles.small}>{'  ·  '}{c.date}</Text> : null}
              </Text>
            ))}
          </View>
        )
      case 'languages':
        if (!languages.length) return null
        return (
          <View key="languages">
            <Text style={styles.sectionTitle}>Languages</Text>
            {languages.map((l, i) => (
              <Text key={i} style={styles.body}>
                <Text style={styles.bold}>{l.language ?? ''}</Text>
                {l.fluency ? <Text style={styles.small}> - {l.fluency}</Text> : null}
              </Text>
            ))}
          </View>
        )
      case 'awards':
        if (!awards.length) return null
        return (
          <View key="awards">
            <Text style={styles.sectionTitle}>Awards</Text>
            {awards.map((a, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ marginBottom: 2 }}>
                  <Text style={styles.bold}>{a.title ?? ''}</Text>
                  {a.date ? <Text style={styles.small}>{'  ·  '}{a.date}</Text> : null}
                </Text>
                {a.awarder ? <Text style={styles.small}>{a.awarder}</Text> : null}
                {a.summary ? <Text style={styles.body}>{a.summary}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'publications':
        if (!publications.length) return null
        return (
          <View key="publications">
            <Text style={styles.sectionTitle}>Publications</Text>
            {publications.map((p, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ marginBottom: 2 }}>
                  <Text style={styles.bold}>{p.name ?? ''}</Text>
                  {p.releaseDate ? <Text style={styles.small}>{'  ·  '}{p.releaseDate}</Text> : null}
                </Text>
                {p.publisher ? <Text style={styles.small}>{p.publisher}</Text> : null}
                {p.summary ? <Text style={styles.body}>{p.summary}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'volunteer':
        if (!volunteer.length) return null
        return (
          <View key="volunteer">
            <Text style={styles.sectionTitle}>Volunteer</Text>
            {volunteer.map((v, i) => {
              const dates = formatDateRange(v.startDate, v.endDate, true)
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={{ marginBottom: 2 }}>
                    <Text style={styles.bold}>{v.organization ?? ''}</Text>
                    {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
                  </Text>
                  <Text style={styles.accent}>{v.position ?? ''}</Text>
                  {renderPdfRichText(v.summary, styles.entrySummary)}
                  {(v.highlights ?? []).map((h, hi) => (
                    <Text key={hi} style={hi === 0 ? [styles.bullet, styles.bulletFirst] : styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                  ))}
                </View>
              )
            })}
          </View>
        )
      case 'interests':
        if (!interests.length) return null
        return (
          <View key="interests">
            <Text style={styles.sectionTitle}>Interests</Text>
            {interests.map((int, i) => (
              <Text key={i} style={styles.body}>
                <Text style={styles.bold}>{int.name ?? ''}</Text>
                {(int.keywords ?? []).length > 0 ? <Text style={{ color: '#555555' }}>: {(int.keywords ?? []).join(', ')}</Text> : null}
                {i < interests.length - 1 ? <Text>{'  |  '}</Text> : null}
              </Text>
            ))}
          </View>
        )
      case 'projects':
        if (!projects.length) return null
        return (
          <View key="projects">
            <Text style={styles.sectionTitle}>Projects</Text>
            {projects.map((p, i) => {
              const dates = formatDateRange(p.startDate, p.endDate)
              return (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={{ marginBottom: 2 }}>
                    <Text style={styles.bold}>{p.name ?? ''}</Text>
                    {dates ? <Text style={styles.small}>{'  ·  '}{dates}</Text> : null}
                  </Text>
                  {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
                  {(p.highlights ?? []).map((h, hi) => <Text key={hi} style={styles.bullet}>• {h}</Text>)}
                  {(p.keywords ?? []).length > 0 ? <Text style={[styles.small, { marginTop: 2 }]}>{(p.keywords ?? []).join(', ')}</Text> : null}
                </View>
              )
            })}
          </View>
        )
      default:
        return null
    }
  }

  const header = (
    <>
      {/* Header */}
      <View style={{ marginBottom: 3 }}>
        <Text style={styles.name}>{basics.name ?? ''}</Text>
        {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
      </View>

      {/* Double rule */}
      <View style={styles.ruleThick} />
      <View style={styles.ruleThin} />

      {/* Contact */}
      {buildContactRow()}

      {/* Summary */}
      {basics.summary ? renderPdfRichText(basics.summary, styles.summary) : null}
    </>
  )

  if (meta.layout === 'two-column') {
    const ca = meta.columnAssignment ?? {}
    const leftSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'left')
    const rightSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'right')
    return (
      <Document {...pdfDocumentProps(data, title)}>
        <Page size="A4" style={styles.page}>
          {header}
          {/* Web two-column: 58% / 42% split with a 24px gap. Each column renders
              top-to-bottom in full so the PDF reading order stays linear. */}
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <View style={{ width: '58%' }}>{leftSections.map(renderPdfSection)}</View>
            <View style={{ flex: 1 }}>{rightSections.map(renderPdfSection)}</View>
          </View>
        </Page>
      </Document>
    )
  }

  return (
    <Document {...pdfDocumentProps(data, title)}>
      <Page size="A4" style={styles.page}>
        {header}

        {/* Sections */}
        {sectionOrder.map(renderPdfSection)}
      </Page>
    </Document>
  )
}
