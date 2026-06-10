import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, resolveSectionOrder, renderPdfRichText, renderPdfRichTextRuns } from './pdf-utils'
import { renderPdfCustomSection } from './renderPdfCustomSection'

const RAIL_SECTIONS = new Set(['skills', 'languages'])

export function SidebarPdfTemplate({ data, meta }: { data: ResumeData; meta: ResumeMeta }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(Math.max(meta.pageMargins * 0.7, 0.35))
  const sectionOrder = resolveSectionOrder(meta)

  const railSections = sectionOrder.filter((s) => !s.startsWith('custom:') && RAIL_SECTIONS.has(s))
  const mainSections = sectionOrder.filter((s) => s.startsWith('custom:') || !RAIL_SECTIONS.has(s))

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: meta.lineSpacing, color: '#000000', flexDirection: 'row' },

    // Left rail
    rail: { width: '33%', backgroundColor: meta.primaryColor, padding: margin, paddingTop: margin },
    railName: { fontFamily: headFont, fontSize: 18, fontWeight: 'bold', color: '#ffffff', lineHeight: 1.1 },
    railLabel: { fontSize: 10.5, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
    railContact: { fontSize: 9, color: 'rgba(255,255,255,0.9)', marginTop: 10, lineHeight: 1.8 },
    railSectionTitle: {
      fontFamily: headFont, fontSize: 10, fontWeight: 'bold', color: '#ffffff',
      textTransform: 'uppercase', letterSpacing: 1,
      borderBottomWidth: 0.75, borderBottomColor: 'rgba(255,255,255,0.35)',
      paddingBottom: 3, marginTop: 16, marginBottom: 6,
    },
    railBody: { fontSize: 9.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 },
    railBold: { fontWeight: 'bold', color: '#ffffff', fontSize: 9.5 },
    railMuted: { color: 'rgba(255,255,255,0.8)', fontSize: 9.5 },

    // Main column
    main: { flex: 1, padding: margin, paddingTop: margin },
    summary: { fontSize: 10, color: '#444444', marginBottom: 8 },
    sectionTitle: {
      fontFamily: headFont, fontSize: 12, fontWeight: 'bold', color: meta.primaryColor,
      textTransform: 'uppercase', letterSpacing: 0.8,
      borderBottomWidth: 2, borderBottomColor: meta.accentColor,
      paddingBottom: 2, marginTop: 14, marginBottom: 7,
    },
    entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    bold: { fontWeight: 'bold' },
    accent: { color: meta.accentColor, fontWeight: 'bold', fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: 10, marginBottom: 1 },
    body: { fontSize: 10 },
  })

  function renderRailSection(kind: string): React.ReactNode {
    if (kind === 'skills' && skills.length > 0) {
      return (
        <View key="skills">
          <Text style={styles.railSectionTitle}>Skills</Text>
          {skills.map((s, i) => (
            <View key={i} style={{ marginBottom: 5 }}>
              <Text style={styles.railBold}>
                {s.name ?? ''}
                {s.level ? <Text style={styles.railMuted}> · {s.level}</Text> : null}
              </Text>
              {(s.keywords ?? []).length > 0 && (
                <Text style={styles.railMuted}>{(s.keywords ?? []).join(', ')}</Text>
              )}
            </View>
          ))}
        </View>
      )
    }
    if (kind === 'languages' && languages.length > 0) {
      return (
        <View key="languages">
          <Text style={styles.railSectionTitle}>Languages</Text>
          {languages.map((l, i) => (
            <Text key={i} style={styles.railBody}>
              <Text style={styles.railBold}>{l.language ?? ''}</Text>
              {l.fluency ? <Text style={styles.railMuted}> – {l.fluency}</Text> : null}
            </Text>
          ))}
        </View>
      )
    }
    return null
  }

  function renderMainSection(section: string): React.ReactNode {
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
                <Text style={styles.body}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
                {edu.score ? <Text style={styles.small}>Score: {edu.score}</Text> : null}
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
              <View key={i} style={styles.entryRow}>
                <Text style={styles.bold}>{c.name ?? ''}{c.issuer ? <Text style={styles.small}> — {c.issuer}</Text> : null}</Text>
                <Text style={styles.small}>{c.date ?? ''}</Text>
              </View>
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
        {/* Left rail — rendered first (column 1 top-to-bottom) */}
        <View style={styles.rail}>
          <Text style={styles.railName}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.railLabel}>{basics.label}</Text> : null}
          <View style={styles.railContact}>
            {[
              basics.email,
              basics.phone,
              basics.url,
              [basics.location?.city, basics.location?.region].filter(Boolean).join(', '),
            ].filter(Boolean).map((p, i) => (
              <Text key={i} style={styles.railContact}>{p}</Text>
            ))}
          </View>
          {railSections.map(renderRailSection)}
        </View>

        {/* Main column — column 2 top-to-bottom */}
        <View style={styles.main}>
          {basics.summary ? renderPdfRichText(basics.summary, styles.summary) : null}
          {mainSections.map(renderMainSection)}
        </View>
      </Page>
    </Document>
  )
}
