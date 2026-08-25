import React from 'react'
import { Document, Page, View, Text, StyleSheet, Link } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { mapToPdfFont, inToPt, resolveSectionOrder, renderPdfRichText, renderPdfRichTextRuns, ensureHttps, pdfDocumentProps } from './pdf-utils'
import { resolveProfiles } from '@/lib/basics-profiles'
import { renderPdfCustomSection } from './renderPdfCustomSection'
import { formatDateRange } from '@/lib/format-date'
import { resolveWorkRoles, resolveEducationRoles } from '@/lib/roles'
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
import { withLineHeights, PdfBullet, PdfEntryHead, sectionReserve, entryReserve } from './pdf-primitives'
import { SIDEBAR_TOKENS as T } from '@/lib/design/tokens'

const PAGE_FONT_SIZE = 11

// react-pdf's default hyphenation is `word => [word]` (@react-pdf/textkit):
// a "word" (whitespace-delimited token) is one indivisible run unless a
// custom callback supplies additional break points. Contact info in the rail
// — emails, URLs — routinely has no whitespace at all, so at the narrow end
// of the rail-width range (20%) a long one renders as a single glyph run
// that overflows the column instead of wrapping.
//
// `hyphenationCallback` is NOT the fix here. Two independent things in
// @react-pdf/textkit insert a literal "-" glyph into the rendered/extracted
// text, and neither is avoidable by supplying a callback:
//   1. A normal hyphenation break (a "penalty" node) always calls
//      `insertGlyph(..., HYPHEN, ...)` when chosen as a line break.
//   2. More surprising: when a single unsplit token ("box") is too wide to
//      fit ANY line at all, textkit's line-breaker falls back to
//      `applyBestFit`, which forces a break there too — and it goes through
//      the exact same hyphen-inserting render path. This happens even with
//      an explicit no-op `hyphenationCallback={(w) => [w]}` (verified by
//      direct render — a callback returning the word unsplit still gets
//      hyphen-split by this fallback once the box doesn't fit).
// Splitting a raw email/URL through hyphenationCallback therefore corrupts
// it (e.g. "...corporate-domain--name..." — a real hyphen doubled with one
// the library injected) wherever it actually wraps, or even where a single
// oversized chunk doesn't fit on its own line.
//
// Instead, long tokens are pre-chunked into pieces small enough to always
// fit within the narrowest realistic rail content width, and rendered as
// sibling <Text> elements inside a flex row that wraps (`flexWrap: 'wrap'`).
// Yoga — the layout engine react-pdf uses for View/Text positioning —
// reflows the chunks onto new lines exactly like ordinary word-wrap. Because
// every chunk is guaranteed to fit, textkit's line-breaker (in either of the
// two paths above) never has a reason to touch a chunk's own content, so no
// separator character is ever inserted: the extracted/copyable text
// reassembles byte-for-byte to the original string whether or not a break
// actually happens (verified via real render + pdf-parse text extraction at
// narrow/medium/wide rail widths — see sidebar-pdf-template.test.tsx).
//
// A4 page width in points, matching the `size="A4"` given to <Page> below.
const A4_WIDTH_PT = 595.28
// Conservative (deliberately wide) estimate of a Latin proportional glyph's
// advance width as a fraction of font size — used only to decide *whether* a
// token risks overflowing the rail, not to lay anything out. Measured against
// this template's actual rendered glyph widths (Calibri-mapped body font at
// 10pt), real average advance came out closer to ~4.5pt/char; 0.65 (6.5pt at
// 10pt) is padded well above that so this estimate only ever over-, never
// under-, predicts a token's width — the failure mode to avoid is silently
// judging an actually-too-wide token as "fits", which would reintroduce the
// overflow. Erring the other way just means chunking a token slightly before
// it's strictly necessary.
const CONTACT_CHAR_WIDTH_RATIO = 0.65
function estimateTextWidthPt(text: string, fontSizePt: number): number {
  return text.length * fontSizePt * CONTACT_CHAR_WIDTH_RATIO
}
// Chunk size used once a token IS being split, derived from the *actual*
// available content width at render time rather than a fixed constant.
// A fixed constant (this used to be a hardcoded `2`) was only ever verified
// safe at the one configuration it was tuned against (pageMargins: 1.0,
// sidebarRailWidth: 20%, usable width ~18pt) — pageMargins and
// sidebarRailWidth are independently user-controllable (DesignPanel
// sliders), and at other combinations (e.g. pageMargins: 1.5 with a 20%
// rail) the available width can be smaller still, small enough that even a
// 2-character chunk overflows and reproduces the same `applyBestFit`
// hyphen-insertion fallback described above. Sizing the chunk from the
// width that's actually available keeps every chunk within budget at any
// margin/rail-width combination, while still using the widest chunk the
// space allows (so ordinary configurations aren't chunked more finely than
// necessary). `RAIL_MIN_CONTENT_WIDTH_PT` below puts a floor under
// `availableWidthPt` itself, so this can never be handed a width so small
// that even a 1-character chunk wouldn't fit.
function computeChunkLength(availableWidthPt: number, fontSizePt: number): number {
  return Math.max(1, Math.floor(availableWidthPt / (fontSizePt * CONTACT_CHAR_WIDTH_RATIO)))
}
const railContactRow: Style = { flexDirection: 'row', flexWrap: 'wrap' }
// Passed to every chunk <Text> as a defensive no-op: without it, react-pdf
// falls back to its own default hyphenation engine (@react-pdf/layout wires
// the real English-pattern hyphenator from the `hyphen` package as the
// default — not a no-op), which could otherwise still attempt to hyphenate a
// chunk that happens to resemble a hyphenatable English fragment. Chunks
// this small make that vanishingly unlikely in practice, but there is no
// cost to foreclosing the path entirely.
const noHyphenate = (word: string): string[] => [word]

/** Splits `text` on whitespace (keeping the whitespace runs themselves as
 * pieces, so real spaces between words are preserved verbatim) and further
 * splits any non-whitespace token estimated too wide for `availableWidthPt`
 * into fixed-size pieces; tokens that already fit stay whole. No characters
 * are added or removed — `pieces.join('')` is always exactly `text`. */
function chunkContactText(text: string, availableWidthPt: number, fontSizePt: number): string[] {
  const chunkLength = computeChunkLength(availableWidthPt, fontSizePt)
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0)
  const pieces: string[] = []
  for (const token of tokens) {
    if (token.trim() === '' || estimateTextWidthPt(token, fontSizePt) <= availableWidthPt) {
      pieces.push(token)
      continue
    }
    for (let i = 0; i < token.length; i += chunkLength) {
      pieces.push(token.slice(i, i + chunkLength))
    }
  }
  return pieces
}

/** Renders rail contact text (email/phone/profile URL/location) so an
 * unbroken token too wide for the rail can wrap without corrupting the text.
 * Whether any chunking happens at all is decided against the rail's actual
 * available width (`availableWidthPt`, from the document's own
 * `sidebarRailWidth`/`pageMargins`) — a token that comfortably fits, like an
 * ordinary email at the default 33% rail, renders exactly as before, as a
 * single <Text>. Only a token estimated too wide for the *specific*
 * document's rail triggers the chunked flex-row rendering. */
function RailContactText({ text, style, availableWidthPt }: { text: string; style: Style; availableWidthPt: number }) {
  const fontSizePt = typeof style.fontSize === 'number' ? style.fontSize : 10
  const hasLongToken = text
    .split(/\s+/)
    .some((t) => t.length > 0 && estimateTextWidthPt(t, fontSizePt) > availableWidthPt)
  if (!hasLongToken) return <Text style={style}>{text}</Text>
  const pieces = chunkContactText(text, availableWidthPt, fontSizePt)
  return (
    <View style={railContactRow}>
      {pieces.map((piece, i) => (
        <Text key={i} style={style} hyphenationCallback={noHyphenate}>{piece}</Text>
      ))}
    </View>
  )
}

export function SidebarPdfTemplate({ data, meta, title }: { data: ResumeData; meta: ResumeMeta; title?: string }) {
  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [] } = data

  const bodyFont = mapToPdfFont(meta.fontFamily)
  const headFont = mapToPdfFont(meta.headerFontFamily)
  const margin = inToPt(Math.max(meta.pageMargins * 0.7, 0.5))
  const railWidthPt = A4_WIDTH_PT * (meta.sidebarRailWidth ?? 33) / 100
  // The rail's padding is normally just `margin` (like the main column's),
  // but `margin` scales with pageMargins while railWidthPt is independently
  // set by sidebarRailWidth (20-40%, both DesignPanel sliders). At a large
  // enough pageMargins combined with a narrow enough rail, `margin * 2` can
  // exceed railWidthPt outright, driving the rail's usable content width to
  // zero or negative — collapsing the box that contact-text chunking (above)
  // depends on having *some* positive width to fit into, no matter how small
  // the chunk. RAIL_MIN_CONTENT_WIDTH_PT floors the content width instead:
  // once the rail is narrow enough that full `margin` padding would eat into
  // this floor, the rail's own padding (not the page-wide `margin`, which
  // still applies to the main column) shrinks just enough to preserve it.
  // 18pt matches the narrowest width this template was originally verified
  // against (pageMargins: 1.0, sidebarRailWidth: 20%) — the floor never
  // makes any previously-working configuration worse, it only kicks in for
  // combinations narrower than that.
  const RAIL_MIN_CONTENT_WIDTH_PT = 18
  const railPadding = Math.max(0, Math.min(margin, (railWidthPt - RAIL_MIN_CONTENT_WIDTH_PT) / 2))
  const railContactWidthPt = Math.max(0, railWidthPt - railPadding * 2)
  const sectionOrder = resolveSectionOrder(meta)

  const ca = meta.columnAssignment ?? {}
  const railSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'left')
  const mainSections = sectionOrder.filter((s) => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'right')
  const SECTION_RESERVE = sectionReserve(PAGE_FONT_SIZE, meta.lineSpacing)
  const ENTRY_RESERVE = entryReserve(PAGE_FONT_SIZE, meta.lineSpacing)
  const styles = withLineHeights(StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: PAGE_FONT_SIZE, lineHeight: meta.lineSpacing, color: '#000000', flexDirection: 'row' },

    // Left rail
    rail: { width: `${meta.sidebarRailWidth ?? 33}%`, backgroundColor: meta.primaryColor, padding: railPadding, paddingTop: railPadding },
    railName: { fontFamily: headFont, fontSize: T.nameSize, fontWeight: 'bold', color: '#ffffff', lineHeight: 1.1 },
    railLabel: { fontSize: T.labelSize, color: 'rgba(255,255,255,0.85)', marginTop: 2.25 },
    railContact: { marginTop: 9 },
    railContactLine: { fontSize: T.contactSize, color: 'rgba(255,255,255,0.9)', lineHeight: 1.9 },
    railSectionTitle: {
      fontFamily: headFont, fontSize: 12, fontWeight: 'bold', color: '#ffffff',
      textTransform: 'uppercase', letterSpacing: 1,
      borderBottomWidth: 0.75, borderBottomColor: meta.accentColor,
      paddingBottom: 2.25, marginTop: 13.5, marginBottom: 5.25,
    },
    railBody: { fontSize: 10, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 },
    railLang: { fontSize: 10, color: '#ffffff', lineHeight: 1.7 },
    railBold: { fontWeight: 'bold', color: '#ffffff', fontSize: 10 },
    railMuted: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
    railKeywords: { color: 'rgba(255,255,255,0.85)', fontSize: 10 },

    // Main column
    main: { flex: 1, padding: margin, paddingTop: margin },
    summary: { fontSize: 10, color: '#444444', marginBottom: T.summaryMarginBottom },
    sectionTitle: {
      fontFamily: headFont, fontSize: T.sectionTitleSize, fontWeight: 'bold', color: meta.primaryColor,
      textTransform: 'uppercase', letterSpacing: 0.7,
      borderBottomWidth: 1.5, borderBottomColor: meta.accentColor,
      paddingBottom: 1.5, marginTop: T.sectionTitleMarginTop, marginBottom: T.sectionTitleMarginBottom,
    },
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
  }), meta.lineSpacing)

  function renderRailSection(kind: string): React.ReactNode {
    if (kind.startsWith('custom:')) {
      const id = kind.slice(7)
      const cs = data.customSections?.find((s) => s.id === id)
      if (!cs || !cs.items.length) return null
      return (
        <View key={kind}>
          <Text style={styles.railSectionTitle}>{cs.name}</Text>
          {cs.items.map((item, i) => (
            <View key={i} style={{ marginBottom: 4.5 }}>
              {item.title ? <Text style={styles.railBold}>{item.title}</Text> : null}
              {cs.enabledFields.includes('summary') && item.summary
                ? <Text style={styles.railBody}>{item.summary}</Text>
                : null}
            </View>
          ))}
        </View>
      )
    }

    switch (kind) {
      case 'skills':
        if (!skills.length) return null
        return (
          <View key="skills">
            <Text style={styles.railSectionTitle}>Skills</Text>
            {skills.map((s, i) => (
              <View key={i} style={{ marginBottom: 4.5 }}>
                <Text style={styles.railBold}>
                  {s.name ?? ''}
                  {s.level ? <Text style={styles.railMuted}> · {s.level}</Text> : null}
                </Text>
                {(s.keywords ?? []).length > 0 && (
                  <Text style={styles.railKeywords}>{(s.keywords ?? []).join(', ')}</Text>
                )}
              </View>
            ))}
          </View>
        )

      case 'languages':
        if (!languages.length) return null
        return (
          <View key="languages">
            <Text style={styles.railSectionTitle}>Languages</Text>
            {languages.map((l, i) => (
              <Text key={i} style={styles.railLang}>
                <Text style={styles.railBold}>{l.language ?? ''}</Text>
                {l.fluency ? <Text style={styles.railKeywords}> - {l.fluency}</Text> : null}
              </Text>
            ))}
          </View>
        )

      case 'work':
        if (!work.length) return null
        return (
          <View key="work">
            <Text style={styles.railSectionTitle}>Work Experience</Text>
            {work.map((job, i) => {
              const roles = resolveWorkRoles(job)
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={styles.railBold}>{job.name ?? ''}</Text>
                  {roles.map((role, ri) => (
                    <View key={role.id ?? ri} style={{ marginTop: ri === 0 ? 0 : 3 }}>
                      <Text style={styles.railBold}>
                        {role.position ?? ''}
                        {formatDateRange(role.startDate, role.endDate) ? (
                          <Text style={styles.railMuted}>{'  ·  '}{formatDateRange(role.startDate, role.endDate)}</Text>
                        ) : null}
                      </Text>
                      {(role.highlights ?? []).map((h, hi) => (
                        <Text key={hi} style={styles.railBody}>• {h}</Text>
                      ))}
                    </View>
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
            <Text style={styles.railSectionTitle}>Education</Text>
            {education.map((edu, i) => {
              const roles = resolveEducationRoles(edu)
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={styles.railBold}>{edu.institution ?? ''}</Text>
                  {roles.map((role, ri) => (
                    <Text key={role.id ?? ri} style={styles.railBody}>
                      {[role.studyType, role.area].filter(Boolean).join(' in ')}
                      {formatDateRange(role.startDate, role.endDate) ? ` · ${formatDateRange(role.startDate, role.endDate)}` : ''}
                    </Text>
                  ))}
                </View>
              )
            })}
          </View>
        )

      case 'certificates':
        if (!certificates.length) return null
        return (
          <View key="certificates">
            <Text style={styles.railSectionTitle}>Certifications</Text>
            {certificates.map((c, i) => (
              <Text key={i} style={{ ...styles.railBold, marginBottom: 4.5 }}>
                {c.name ?? ''}
                {c.issuer ? <Text style={styles.railMuted}> - {c.issuer}</Text> : null}
                {c.date ? <Text style={styles.railMuted}>{'  ·  '}{c.date}</Text> : null}
              </Text>
            ))}
          </View>
        )

      case 'awards':
        if (!awards.length) return null
        return (
          <View key="awards">
            <Text style={styles.railSectionTitle}>Awards</Text>
            {awards.map((a, i) => (
              <View key={i} style={{ marginBottom: 4.5 }}>
                <Text style={styles.railBold}>
                  {a.title ?? ''}
                  {a.date ? <Text style={styles.railMuted}>{'  ·  '}{a.date}</Text> : null}
                </Text>
                {a.awarder ? <Text style={styles.railBody}>{a.awarder}</Text> : null}
              </View>
            ))}
          </View>
        )

      case 'publications':
        if (!publications.length) return null
        return (
          <View key="publications">
            <Text style={styles.railSectionTitle}>Publications</Text>
            {publications.map((p, i) => (
              <View key={i} style={{ marginBottom: 4.5 }}>
                <Text style={styles.railBold}>
                  {p.name ?? ''}
                  {p.releaseDate ? <Text style={styles.railMuted}>{'  ·  '}{p.releaseDate}</Text> : null}
                </Text>
                {p.publisher ? <Text style={styles.railBody}>{p.publisher}</Text> : null}
              </View>
            ))}
          </View>
        )

      case 'volunteer':
        if (!volunteer.length) return null
        return (
          <View key="volunteer">
            <Text style={styles.railSectionTitle}>Volunteer</Text>
            {volunteer.map((v, i) => {
              const dates = formatDateRange(v.startDate, v.endDate)
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={styles.railBold}>
                    {v.organization ?? ''}
                    {dates ? <Text style={styles.railMuted}>{'  ·  '}{dates}</Text> : null}
                  </Text>
                  {v.position ? <Text style={styles.railBody}>{v.position}</Text> : null}
                </View>
              )
            })}
          </View>
        )

      case 'interests':
        if (!interests.length) return null
        return (
          <View key="interests">
            <Text style={styles.railSectionTitle}>Interests</Text>
            {interests.map((int, i) => (
              <Text key={i} style={styles.railBody}>
                <Text style={styles.railBold}>{int.name ?? ''}</Text>
                {(int.keywords ?? []).length > 0
                  ? <Text style={styles.railKeywords}>: {(int.keywords ?? []).join(', ')}</Text>
                  : null}
              </Text>
            ))}
          </View>
        )

      case 'projects':
        if (!projects.length) return null
        return (
          <View key="projects">
            <Text style={styles.railSectionTitle}>Projects</Text>
            {projects.map((p, i) => {
              const dates = formatDateRange(p.startDate, p.endDate)
              return (
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={styles.railBold}>
                    {p.name ?? ''}
                    {dates ? <Text style={styles.railMuted}>{'  ·  '}{dates}</Text> : null}
                  </Text>
                  {p.description ? <Text style={styles.railBody}>{p.description}</Text> : null}
                  {(p.highlights ?? []).map((h, hi) => (
                    <Text key={hi} style={styles.railBody}>• {h}</Text>
                  ))}
                </View>
              )
            })}
          </View>
        )

      default:
        return null
    }
  }

  function renderMainSection(section: string): React.ReactNode {
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
              const roles = resolveWorkRoles(job)
              return (
                <View key={i} style={{ marginBottom: T.entryMarginBottom }}>
                  <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                    <PdfEntryHead
                      style={{ marginBottom: 2 }}
                      left={<Text style={styles.bold}>{job.name ?? ''}</Text>}
                    />
                  </View>
                  {roles.map((role, ri) => {
                    const roleDates = formatDateRange(role.startDate, role.endDate)
                    return (
                      <React.Fragment key={role.id ?? ri}>
                        <View wrap={false} minPresenceAhead={ENTRY_RESERVE} style={{ marginTop: ri === 0 ? 0 : 4 }}>
                          <PdfEntryHead
                            style={{ marginBottom: 2 }}
                            left={<Text style={styles.accent}>{role.position ?? ''}</Text>}
                            right={roleDates ? <Text style={styles.small}>{roleDates}</Text> : undefined}
                          />
                        </View>
                        {/* summary/highlights stay outside wrap={false} — an
                            unbounded highlight longer than a page must still
                            paginate instead of crashing react-pdf. */}
                        {renderPdfRichText(role.summary, styles.entrySummary)}
                        {(role.highlights ?? []).map((h, hi) => (
                          <PdfBullet
                            key={hi}
                            style={hi === 0 ? [styles.bulletHang, styles.bulletFirst] : styles.bulletHang}
                            indent={T.bulletIndent}
                            gap={T.bulletGap}
                          >
                            {renderPdfRichTextRuns(h)}
                          </PdfBullet>
                        ))}
                      </React.Fragment>
                    )
                  })}
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
              const roles = resolveEducationRoles(edu)
              return (
                <View key={i} style={{ marginBottom: T.eduMarginBottom }}>
                  <View wrap={false} minPresenceAhead={ENTRY_RESERVE}>
                    <PdfEntryHead
                      style={{ marginBottom: 2 }}
                      left={<Text style={styles.bold}>{edu.institution ?? ''}</Text>}
                    />
                  </View>
                  {roles.map((role, ri) => {
                    const roleDates = formatDateRange(role.startDate, role.endDate)
                    return (
                      <View key={role.id ?? ri} wrap={false} minPresenceAhead={ENTRY_RESERVE} style={{ marginTop: ri === 0 ? 0 : 3 }}>
                        <PdfEntryHead
                          style={{ marginBottom: 2 }}
                          left={<Text style={styles.degree}>{[role.studyType, role.area].filter(Boolean).join(' in ')}</Text>}
                          right={roleDates ? <Text style={styles.small}>{roleDates}</Text> : undefined}
                        />
                        {role.score ? <Text style={styles.small}>Score: {role.score}</Text> : null}
                      </View>
                    )
                  })}
                </View>
              )
            })}
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
                  {c.issuer ? <Text style={styles.small}> - {c.issuer}</Text> : null}
                </Text>
                {c.date ? <Text style={styles.small}>{'  ·  '}{c.date}</Text> : null}
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
              const dates = formatDateRange(v.startDate, v.endDate)
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

  return (
    <Document {...pdfDocumentProps(data, title)}>
      <Page size="A4" style={styles.page}>
        {/* Left rail — rendered first (column 1 top-to-bottom) */}
        <View style={styles.rail}>
          <Text style={styles.railName}>{basics.name ?? ''}</Text>
          {basics.label ? <Text style={styles.railLabel}>{basics.label}</Text> : null}
          <View style={styles.railContact}>
            {basics.email ? <RailContactText style={styles.railContactLine} text={basics.email} availableWidthPt={railContactWidthPt} /> : null}
            {basics.phone ? <RailContactText style={styles.railContactLine} text={basics.phone} availableWidthPt={railContactWidthPt} /> : null}
            {resolveProfiles(basics).filter((p) => p.url).map((p) => (
              <Link key={p.id} src={ensureHttps(p.url!)} style={{ textDecoration: 'none' }}>
                <RailContactText style={styles.railContactLine} text={p.label || p.url!} availableWidthPt={railContactWidthPt} />
              </Link>
            ))}
            {[basics.location?.city, basics.location?.region].filter(Boolean).join(', ') ? (
              <RailContactText
                style={styles.railContactLine}
                availableWidthPt={railContactWidthPt}
                text={[basics.location?.city, basics.location?.region].filter(Boolean).join(', ')}
              />
            ) : null}
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
