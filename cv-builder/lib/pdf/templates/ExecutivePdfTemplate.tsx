import React from 'react'
import { Document, Page, View, Text, StyleSheet, Link } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, resolveSectionOrder, ensureHttps, renderPdfRichText, renderPdfRichTextRuns } from './pdf-utils'
import { renderPdfCustomSection } from './renderPdfCustomSection'

export function ExecutivePdfTemplate({ data, meta }: { data: ResumeData; meta: ResumeMeta }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(meta.pageMargins)
  const sectionOrder = resolveSectionOrder(meta)

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: meta.lineSpacing, padding: margin, color: '#000000' },
    name: { fontFamily: headFont, fontSize: 26, fontWeight: 'bold', color: meta.primaryColor, marginBottom: 2 },
    subtitle: { fontSize: 12, color: meta.accentColor, fontStyle: 'italic', marginTop: 1 },
    ruleThick: { borderTopWidth: 2, borderTopColor: meta.primaryColor, marginTop: 6, marginBottom: 1 },
    ruleThin: { borderTopWidth: 0.75, borderTopColor: meta.primaryColor, marginBottom: 8 },
    contact: { fontSize: 10, color: '#555555', marginTop: 2 },
    sectionTitle: {
      fontFamily: headFont, fontSize: 11.5, fontWeight: 'bold', color: meta.primaryColor,
      textTransform: 'uppercase', letterSpacing: 1.2,
      borderBottomWidth: 1, borderBottomColor: meta.primaryColor,
      paddingBottom: 3, marginTop: 16, marginBottom: 6,
    },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    bold: { fontWeight: 'bold' },
    accent: { color: meta.accentColor, fontStyle: 'italic', fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: 10, marginBottom: 1 },
    body: { fontSize: 10, textAlign: 'justify' },
    summary: { fontSize: 10.5, textAlign: 'justify', marginTop: 10 },
  })

  function buildContactParts(): string {
    const items: string[] = []
    if (basics.email) items.push(basics.email)
    if (basics.phone) items.push(basics.phone)
    if (basics.url) items.push(basics.url)
    const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
    if (loc) items.push(loc)
    return items.join('   |   ')
  }

  function renderPdfSection(section: string): React.ReactNode {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs) return null
      return renderPdfCustomSection(cs, { sectionTitle: styles.sectionTitle, entryRow: styles.entryRow, bold: styles.bold, accent: styles.accent, small: styles.small, body: styles.body, bullet: styles.bullet })
    }
    switch (section) {
      case 'work':
        if (!work.length) return null
        return (
          <View key="work">
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {work.map((job, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{job.name ?? ''}</Text>
                  <Text style={styles.small}>{[job.startDate, job.endDate || 'Present'].filter(Boolean).join(' – ')}</Text>
                </View>
                <Text style={styles.accent}>{job.position ?? ''}</Text>
                {renderPdfRichText(job.summary, styles.body)}
                {(job.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))}
              </View>
            ))}
          </View>
        )
      case 'education':
        if (!education.length) return null
        return (
          <View key="education">
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{edu.institution ?? ''}</Text>
                  <Text style={styles.small}>{[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}</Text>
                </View>
                <Text style={[styles.body, { fontStyle: 'italic' }]}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
                {edu.score ? <Text style={styles.small}>Score: {edu.score}</Text> : null}
              </View>
            ))}
          </View>
        )
      case 'skills':
        if (!skills.length) return null
        return (
          <View key="skills">
            <Text style={styles.sectionTitle}>Skills</Text>
            {skills.map((s, i) => (
              <Text key={i} style={styles.body}>
                <Text style={styles.bold}>{s.name ?? ''}</Text>
                {s.level ? <Text style={styles.small}> · {s.level}</Text> : null}
                {(s.keywords ?? []).length > 0 ? <Text style={{ color: '#555555' }}>: {(s.keywords ?? []).join(', ')}</Text> : null}
              </Text>
            ))}
          </View>
        )
      case 'certificates':
        if (!certificates.length) return null
        return (
          <View key="certificates">
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certificates.map((c, i) => (
              <View key={i} style={styles.entryRow}>
                <Text style={styles.bold}>{c.name ?? ''}{c.issuer ? <Text style={styles.small}> — {c.issuer}</Text> : null}</Text>
                <Text style={styles.small}>{c.date ?? ''}</Text>
              </View>
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
                {l.fluency ? <Text style={styles.small}> – {l.fluency}</Text> : null}
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
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{a.title ?? ''}</Text>
                  <Text style={styles.small}>{a.date ?? ''}</Text>
                </View>
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
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{p.name ?? ''}</Text>
                  <Text style={styles.small}>{p.releaseDate ?? ''}</Text>
                </View>
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
            {volunteer.map((v, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{v.organization ?? ''}</Text>
                  <Text style={styles.small}>{[v.startDate, v.endDate || 'Present'].filter(Boolean).join(' – ')}</Text>
                </View>
                <Text style={styles.accent}>{v.position ?? ''}</Text>
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
            {projects.map((p, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.bold}>{p.name ?? ''}</Text>
                  <Text style={styles.small}>{[p.startDate, p.endDate].filter(Boolean).join(' – ')}</Text>
                </View>
                {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
                {(p.highlights ?? []).map((h, hi) => <Text key={hi} style={styles.bullet}>• {h}</Text>)}
                {(p.keywords ?? []).length > 0 ? <Text style={[styles.small, { marginTop: 2 }]}>{(p.keywords ?? []).join(', ')}</Text> : null}
              </View>
            ))}
          </View>
        )
      default:
        return null
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
        </View>

        {/* Double rule */}
        <View style={styles.ruleThick} />
        <View style={styles.ruleThin} />

        {/* Contact */}
        <Text style={styles.contact}>{buildContactParts()}</Text>

        {/* Summary */}
        {basics.summary ? renderPdfRichText(basics.summary, styles.summary) : null}

        {/* Sections */}
        {sectionOrder.map(renderPdfSection)}
      </Page>
    </Document>
  )
}
