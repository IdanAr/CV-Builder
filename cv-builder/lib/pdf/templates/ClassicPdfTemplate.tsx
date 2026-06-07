import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, formatContact, resolveSectionOrder } from './pdf-utils'
import { renderPdfCustomSection } from './renderPdfCustomSection'

export function ClassicPdfTemplate({ data, meta }: { data: ResumeData; meta: ResumeMeta }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(meta.pageMargins)
  const sectionOrder = resolveSectionOrder(meta)

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: meta.lineSpacing, padding: margin, color: '#000000' },
    name: { fontFamily: headFont, fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 3 },
    subtitle: { fontSize: 11, color: '#555555', textAlign: 'center' },
    contact: { fontSize: 10, color: '#555555', textAlign: 'center', marginTop: 3 },
    sectionTitle: { fontFamily: headFont, fontSize: 13, fontWeight: 'bold', color: meta.primaryColor,
      borderBottomWidth: 1, borderBottomColor: meta.primaryColor, paddingBottom: 2, marginTop: 14, marginBottom: 6 },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    bold: { fontWeight: 'bold' },
    accent: { color: meta.accentColor, fontWeight: 'bold', fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: 10, marginBottom: 1 },
    body: { fontSize: 10 },
    summaryBox: { fontSize: 10, marginTop: 8 },
  })

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
                {job.summary ? <Text style={styles.body}>{job.summary}</Text> : null}
                {(job.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={styles.bullet}>• {h}</Text>
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
                <Text style={styles.body}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
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
                {s.level ? <Text style={styles.small}> ({s.level})</Text> : null}
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
            <Text style={styles.body}>
              {languages.map((l, i) => (
                <Text key={i}>
                  <Text style={styles.bold}>{l.language ?? ''}</Text>
                  {l.fluency ? <Text style={styles.small}> ({l.fluency})</Text> : null}
                  {i < languages.length - 1 ? <Text>{'  ·  '}</Text> : null}
                </Text>
              ))}
            </Text>
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
                {v.summary ? <Text style={styles.body}>{v.summary}</Text> : null}
                {(v.highlights ?? []).map((h, hi) => <Text key={hi} style={styles.bullet}>• {h}</Text>)}
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

  if (meta.layout === 'two-column') {
    const leftSections = sectionOrder.filter((s) => ['work', 'education', 'volunteer'].includes(s) || s.startsWith('custom:'))
    const rightSections = sectionOrder.filter((s) => !leftSections.includes(s))
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.name}>{basics.name ?? ''}</Text>
            {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
            <Text style={styles.contact}>{formatContact(basics)}</Text>
            {basics.summary ? <Text style={styles.summaryBox}>{basics.summary}</Text> : null}
          </View>
          {/* Decorative divider — tagged as artifact */}
          <View aria-hidden={true} style={{ borderBottomWidth: 0.5, borderBottomColor: '#cccccc', marginBottom: 4 }} />
          {/* Two columns: left fully then right */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 0.58 }}>{leftSections.map(renderPdfSection)}</View>
            <View style={{ flex: 0.42 }}>{rightSections.map(renderPdfSection)}</View>
          </View>
        </Page>
      </Document>
    )
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
          <Text style={styles.contact}>{formatContact(basics)}</Text>
        </View>
        {basics.summary ? (
          <View>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.body}>{basics.summary}</Text>
          </View>
        ) : null}
        {sectionOrder.map(renderPdfSection)}
      </Page>
    </Document>
  )
}
