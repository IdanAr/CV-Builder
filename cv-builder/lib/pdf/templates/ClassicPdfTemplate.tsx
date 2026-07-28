import React from 'react'
import { Document, Page, View, Text, StyleSheet, Link } from '@react-pdf/renderer'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, resolveSectionOrder, ensureHttps, renderPdfRichText, renderPdfRichTextRuns, pdfDocumentProps } from './pdf-utils'
import { renderPdfCustomSection } from './renderPdfCustomSection'
import { getColumnSide } from '@/lib/get-column-side'
import { formatDateRange } from '@/lib/format-date'
import { withLineHeights, PdfBullet, PdfEntryHead, sectionReserve, entryReserve } from './pdf-primitives'
import { CLASSIC_TOKENS as T } from '@/lib/design/tokens'

const PAGE_FONT_SIZE = 11

export function ClassicPdfTemplate({ data, meta, title }: { data: ResumeData; meta: ResumeMeta; title?: string }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(meta.pageMargins)
  const sectionOrder = resolveSectionOrder(meta)
  const SECTION_RESERVE = sectionReserve(PAGE_FONT_SIZE, meta.lineSpacing)
  const ENTRY_RESERVE = entryReserve(PAGE_FONT_SIZE, meta.lineSpacing)
  const styles = withLineHeights(StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: PAGE_FONT_SIZE, lineHeight: meta.lineSpacing, padding: margin, color: '#000000' },
    name: { fontFamily: headFont, fontSize: T.nameSize, fontWeight: 'bold', textAlign: 'center', marginBottom: 1.5 },
    subtitle: { fontSize: T.labelSize, color: '#555555', textAlign: 'center' },
    sectionTitle: { fontFamily: headFont, fontSize: T.sectionTitleSize, fontWeight: 'bold', color: meta.primaryColor,
      borderBottomWidth: 1.1, borderBottomColor: meta.primaryColor, paddingBottom: 2, marginTop: T.sectionTitleMarginTop, marginBottom: T.sectionTitleMarginBottom },
    bold: { fontWeight: 'bold' },
    // Web renders the position at font-weight 500, which core PDF fonts lack — regular is the nearest face
    accent: { color: meta.accentColor, fontSize: 10.5 },
    small: { fontSize: 10, color: '#666666' },
    bullet: { fontSize: 10, marginLeft: T.bulletIndent, marginBottom: 1 },
    // Used inside PdfBullet, whose row already applies the hanging indent via
    // its own `indent` prop; this omits marginLeft so it is not applied twice.
    bulletHang: { fontSize: 10, marginBottom: 1 },
    bulletFirst: { marginTop: 3 },
    body: { fontSize: T.bodySize },
    entrySummary: { fontSize: 10, marginTop: 2 },
    degree: { fontSize: 10.5 },
    summaryBox: { fontSize: 10, fontStyle: 'italic', marginBottom: T.summaryMarginBottom },
  }), meta.lineSpacing)

  function buildContactRow() {
    const items: Array<{ label: string; href: string }> = []
    if (basics.email) items.push({ label: basics.email, href: `mailto:${basics.email}` })
    if (basics.phone) items.push({ label: basics.phone, href: '' })
    if (basics.url) items.push({ label: basics.url, href: ensureHttps(basics.url) })
    const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
    if (loc) items.push({ label: loc, href: '' })
    if (!items.length) return null
    return (
      <Text style={{ fontSize: T.contactSize, color: '#555555', textAlign: 'center', marginTop: 3 }}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {item.href
              ? <Link src={item.href} style={{ textDecoration: 'none' }}><Text style={{ color: '#555555' }}>{item.label}</Text></Link>
              : <Text style={{ color: '#555555' }}>{item.label}</Text>
            }
            {i < items.length - 1 && <Text style={{ color: '#555555' }}> · </Text>}
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
      return renderPdfCustomSection(cs, { sectionTitle: styles.sectionTitle, bold: styles.bold, accent: styles.accent, small: styles.small, body: styles.entrySummary, bullet: styles.bullet })
    }
    switch (section) {
      case 'work':
        if (!work.length) return null
        return (
          <View key="work">
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Work Experience</Text>
            </View>
            {work.map((job, i) => {
              const dates = formatDateRange(job.startDate, job.endDate, true)
              return (
                <View key={i} style={{ marginBottom: T.entryMarginBottom }}>
                  <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                    <PdfEntryHead
                      style={{ marginBottom: 2 }}
                      left={<Text style={styles.bold}>{job.name ?? ''}</Text>}
                      right={dates ? <Text style={styles.small}>{dates}</Text> : undefined}
                    />
                    <Text style={styles.accent}>{job.position ?? ''}</Text>
                  </View>
                  {renderPdfRichText(job.summary, styles.entrySummary)}
                  {(job.highlights ?? []).map((h, hi) => (
                    <PdfBullet
                      key={hi}
                      style={hi === 0 ? [styles.bulletHang, styles.bulletFirst] : styles.bulletHang}
                      indent={T.bulletIndent}
                      gap={T.bulletGap}
                    >
                      {renderPdfRichTextRuns(h)}
                    </PdfBullet>
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
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Education</Text>
            </View>
            {education.map((edu, i) => {
              const dates = formatDateRange(edu.startDate, edu.endDate)
              return (
                <View key={i} style={{ marginBottom: T.eduMarginBottom }}>
                  <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                    <PdfEntryHead
                      style={{ marginBottom: 2 }}
                      left={<Text style={styles.bold}>{edu.institution ?? ''}</Text>}
                      right={dates ? <Text style={styles.small}>{dates}</Text> : undefined}
                    />
                    <Text style={styles.degree}>{[edu.studyType, edu.area].filter(Boolean).join(' in ')}</Text>
                  </View>
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
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Skills</Text>
            </View>
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
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Certifications</Text>
            </View>
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
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Languages</Text>
            </View>
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
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Awards</Text>
            </View>
            {awards.map((a, i) => (
              <View key={i} style={{ marginBottom: T.eduMarginBottom }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  <PdfEntryHead
                    style={{ marginBottom: 2 }}
                    left={<Text style={styles.bold}>{a.title ?? ''}</Text>}
                    right={a.date ? <Text style={styles.small}>{a.date}</Text> : undefined}
                  />
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
              <Text style={styles.sectionTitle}>Publications</Text>
            </View>
            {publications.map((p, i) => (
              <View key={i} style={{ marginBottom: T.eduMarginBottom }}>
                <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                  <PdfEntryHead
                    style={{ marginBottom: 2 }}
                    left={<Text style={styles.bold}>{p.name ?? ''}</Text>}
                    right={p.releaseDate ? <Text style={styles.small}>{p.releaseDate}</Text> : undefined}
                  />
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
              <Text style={styles.sectionTitle}>Volunteer</Text>
            </View>
            {volunteer.map((v, i) => {
              const dates = formatDateRange(v.startDate, v.endDate, true)
              return (
                <View key={i} style={{ marginBottom: T.eduMarginBottom }}>
                  <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                    <PdfEntryHead
                      style={{ marginBottom: 2 }}
                      left={<Text style={styles.bold}>{v.organization ?? ''}</Text>}
                      right={dates ? <Text style={styles.small}>{dates}</Text> : undefined}
                    />
                    <Text style={styles.accent}>{v.position ?? ''}</Text>
                  </View>
                  {renderPdfRichText(v.summary, styles.entrySummary)}
                  {(v.highlights ?? []).map((h, hi) => (
                    <PdfBullet
                      key={hi}
                      style={hi === 0 ? [styles.bulletHang, styles.bulletFirst] : styles.bulletHang}
                      indent={T.bulletIndent}
                      gap={T.bulletGap}
                    >
                      {renderPdfRichTextRuns(h)}
                    </PdfBullet>
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
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Interests</Text>
            </View>
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
            <View wrap={false} minPresenceAhead={SECTION_RESERVE}>
              <Text style={styles.sectionTitle}>Projects</Text>
            </View>
            {projects.map((p, i) => {
              const dates = formatDateRange(p.startDate, p.endDate)
              return (
                <View key={i} style={{ marginBottom: T.projectMarginBottom }}>
                  <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                    <PdfEntryHead
                      style={{ marginBottom: 2 }}
                      left={<Text style={styles.bold}>{p.name ?? ''}</Text>}
                      right={dates ? <Text style={styles.small}>{dates}</Text> : undefined}
                    />
                  </View>
                  {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
                  {(p.highlights ?? []).map((h, hi) => (
                    <PdfBullet key={hi} style={styles.bulletHang} indent={T.bulletIndent} gap={T.bulletGap}>
                      {h}
                    </PdfBullet>
                  ))}
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

  if (meta.layout === 'two-column') {
    const ca = meta.columnAssignment ?? {}
    const leftSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'left')
    const rightSections = sectionOrder.filter((s) => getColumnSide(s, ca) === 'right')
    return (
      <Document {...pdfDocumentProps(data, title)}>
        <Page size="A4" style={styles.page}>
          <View style={{ marginBottom: T.headerMarginBottom }}>
            <Text style={styles.name}>{basics.name ?? ''}</Text>
            {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
            {buildContactRow()}
          </View>
          {renderPdfRichText(basics.summary, styles.summaryBox)}
          {/* Two columns: left fully then right */}
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <View style={{ flex: 0.58 }}>{leftSections.map(renderPdfSection)}</View>
            <View style={{ flex: 0.42 }}>{rightSections.map(renderPdfSection)}</View>
          </View>
        </Page>
      </Document>
    )
  }

  return (
    <Document {...pdfDocumentProps(data, title)}>
      <Page size="A4" style={styles.page}>
        <View style={{ marginBottom: T.headerMarginBottom }}>
          <Text style={styles.name}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.subtitle}>{basics.label}</Text> : null}
          {buildContactRow()}
        </View>
        {basics.summary ? (
          <View>
            <Text style={styles.sectionTitle}>Summary</Text>
            {renderPdfRichText(basics.summary, styles.body)}
          </View>
        ) : null}
        {sectionOrder.map(renderPdfSection)}
      </Page>
    </Document>
  )
}
