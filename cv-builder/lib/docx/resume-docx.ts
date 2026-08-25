import {
  Document, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ShadingType, WidthType, convertInchesToTwip,
} from 'docx'
import type { IParagraphOptions } from 'docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import type { ExportMode } from '@/lib/export-mode'
import { parseRichText, splitParagraphs, TextRun as RichTextRun } from '@/lib/rich-text'
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
import { formatDate, formatDateRange } from '@/lib/format-date'
import { buildDocxStyles } from './styles'
import { resolveProfiles } from '@/lib/basics-profiles'
import { resolveWorkRoles, resolveEducationRoles, resolveCustomSectionRoles } from '@/lib/roles'

function richTextRuns(
  text: string,
  font: string,
  size: number,
  extraProps?: Partial<{ bold: boolean; color: string; italics: boolean }>
): TextRun[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: TextRun[] = []
  lines.forEach((line, i) => {
    if (i > 0) {
      out.push(new TextRun({ text: '', break: 1, font, size }))
    }
    const runs: RichTextRun[] = parseRichText(line)
    for (const run of runs) {
      out.push(new TextRun({
        text: run.text,
        font,
        size,
        bold: run.bold || extraProps?.bold || false,
        italics: run.italic || extraProps?.italics || false,
        underline: run.underline ? {} : undefined,
        ...(extraProps?.color ? { color: extraProps.color } : {}),
      }))
    }
  })
  return out
}

/**
 * Renders a rich-text field as one Word paragraph per blank-line-separated
 * paragraph, so a multi-paragraph summary shows real breaks — a single
 * Paragraph with embedded newlines does not. Soft line breaks within a
 * paragraph are handled by richTextRuns (a Break run between lines), so a
 * paragraph here may itself span multiple visual lines. The given paragraph
 * props (spacing, alignment, keepLines) apply to every generated paragraph, so
 * single-paragraph text produces exactly one Paragraph, unchanged from before.
 */
function richTextParagraphs(
  text: string,
  font: string,
  size: number,
  extraProps: Partial<{ bold: boolean; color: string; italics: boolean }> | undefined,
  paraProps: Omit<IParagraphOptions, 'children'>
): Paragraph[] {
  return splitParagraphs(text)
    .map((lines) => lines.join('\n'))
    .map(paragraphText =>
      new Paragraph({ ...paraProps, children: richTextRuns(paragraphText, font, size, extraProps) })
    )
}

function mapFont(font: string): string {
  const map: Record<string, string> = {
    'Lato': 'Arial',
    'Roboto': 'Arial',
    'IBM Plex Sans': 'Calibri',
    'Helvetica': 'Arial',
  }
  return map[font] ?? font
}

interface DocxTheme {
  sectionTitleColor: string
  sectionUppercase: boolean
  sectionBorder: boolean
  sectionBorderColor?: string // defaults to sectionTitleColor
  sectionBorderSize?: number // eighths of a point, defaults to 9 (1.5px web)
  accentColor: string
  headerFill?: string
  nameSize: number // half-points
  headingSize: number // half-points
  headerAlign: (typeof AlignmentType)[keyof typeof AlignmentType]
  summaryHeading: boolean
  summaryColor?: string
  summarySize?: number // half-points, defaults to 20
  labelSize?: number // half-points, defaults to 24
  summaryJustified?: boolean
  bodyJustified?: boolean
  contactColor?: string
  contactSeparator?: string
  nameColor?: string
  labelColor?: string
  labelItalics?: boolean
  positionItalics?: boolean
  headerRule?: boolean // decorative double rule under the name (executive)
}

// Mirrors the visual identity of the matching live-preview/PDF template,
// using only native paragraph styling (shading/borders/color) so the
// DOCX stays ATS-parseable (no text boxes, floating objects, or tables).
function buildDocxTheme(meta: ResumeMeta): DocxTheme {
  switch (meta.templateId) {
    case 'modern':
      // Web modern: left-aligned filled header, 22pt name, 12pt uppercase accent headings, plain #444 summary
      return {
        sectionTitleColor: meta.accentColor,
        sectionUppercase: true,
        sectionBorder: false,
        accentColor: meta.accentColor,
        headerFill: meta.primaryColor,
        nameSize: 44,
        headingSize: 24,
        headerAlign: AlignmentType.LEFT,
        summaryHeading: false,
        summaryColor: '444444',
      }
    case 'minimal':
      // Web minimal: centered header, 22pt name, 10pt uppercase #333 headings, plain #444 summary, accent positions
      return {
        sectionTitleColor: '#333333',
        sectionUppercase: true,
        sectionBorder: false,
        accentColor: meta.accentColor,
        nameSize: 44,
        headingSize: 20,
        headerAlign: AlignmentType.CENTER,
        summaryHeading: false,
        summaryColor: '444444',
        contactColor: '777777',
        contactSeparator: '  ·  ',
      }
    case 'executive':
      // Web executive: left-aligned header with primary-color 22pt name, double rule,
      // italic accent label/positions, justified 10.5pt summary without a heading
      return {
        sectionTitleColor: meta.primaryColor,
        sectionUppercase: true,
        sectionBorder: true,
        sectionBorderSize: 6, // 1px web rule
        accentColor: meta.accentColor,
        nameSize: 44,
        headingSize: 23,
        headerAlign: AlignmentType.LEFT,
        summaryHeading: false,
        summarySize: 21,
        summaryJustified: true,
        bodyJustified: true,
        nameColor: meta.primaryColor,
        labelColor: meta.accentColor,
        labelItalics: true,
        positionItalics: true,
        contactSeparator: '   |   ',
        headerRule: true,
      }
    case 'sidebar':
      // Main-column styling; the rail itself is built as a shaded table cell in buildDocx.
      // Web sidebar: left-aligned 18pt name, 12pt uppercase primary headings with accent underline
      return {
        sectionTitleColor: meta.primaryColor,
        sectionUppercase: true,
        sectionBorder: true,
        sectionBorderColor: meta.accentColor,
        sectionBorderSize: 12, // 2px web rule
        accentColor: meta.accentColor,
        nameSize: 36,
        headingSize: 24,
        labelSize: 21,
        headerAlign: AlignmentType.LEFT,
        summaryHeading: false,
        summaryColor: '444444',
      }
    default:
      // Web classic: centered header, 20pt name, 13pt underlined headings
      return {
        sectionTitleColor: meta.primaryColor,
        sectionUppercase: false,
        sectionBorder: true,
        accentColor: meta.accentColor,
        nameSize: 40,
        headingSize: 26,
        headerAlign: AlignmentType.CENTER,
        summaryHeading: true,
      }
  }
}

// Neutral dark-on-white theme for ATS exports: no header fill, no light
// tints, headings keep the template's primary color. Sizes per the
// typography constraints (name 20pt, headings 13pt — half-points here).
function buildAtsDocxTheme(meta: ResumeMeta): DocxTheme {
  return {
    sectionTitleColor: meta.primaryColor,
    sectionUppercase: true,
    sectionBorder: true,
    sectionBorderSize: 6,
    accentColor: '333333',
    nameSize: 40,
    headingSize: 26,
    headerAlign: AlignmentType.LEFT,
    summaryHeading: true,
  }
}

function sectionHeading(text: string, font: string, theme: DocxTheme): Paragraph {
  return new Paragraph({
    style: 'Heading1',
    children: [new TextRun({
      text: theme.sectionUppercase ? text.toUpperCase() : text,
      font,
    })],
    // Web section titles: 18px top / 8px bottom margins, 1.5px underline
    spacing: { before: 270, after: 120 },
    // Keep the heading glued to whatever paragraph follows it — a heading
    // alone at the foot of a page is the same orphan the PDF reserve logic
    // guards against.
    keepNext: true,
    ...(theme.sectionBorder
      ? { border: { bottom: { style: BorderStyle.SINGLE, size: theme.sectionBorderSize ?? 9, color: theme.sectionBorderColor ?? theme.sectionTitleColor, space: 4 } } }
      : {}),
  })
}

function jobEntry(
  name: string, position: string, dates: string, summary: string | undefined,
  highlights: string[], font: string, theme: DocxTheme, tabWidthTwips: number
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      style: 'Heading2',
      children: [
        // Heading2's style run/paragraph properties exist for the outline
        // (Word nav pane / ATS section detection), not for this entry's
        // look — the entry head keeps its own plain-black, undersized
        // appearance, so color and spacing-after are pinned explicitly
        // rather than left to inherit the section-heading accent color and
        // 6pt trailing gap the style otherwise contributes.
        new TextRun({ text: name, bold: true, font, size: 22, color: '000000' }),
        new TextRun({ text: `\t${dates}`, font, size: 20, color: '666666' }),
      ],
      tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
      spacing: { before: 150, after: 0 },
      // Keep the entry head on the same page as the position line that
      // identifies it, matching the PDF entry-atomicity treatment.
      keepNext: true,
    }),
    new Paragraph({
      children: [new TextRun({ text: position, font, size: 21, color: theme.accentColor, italics: theme.positionItalics || false })],
      spacing: { after: 40 },
      keepLines: true,
    }),
  ]
  if (summary) {
    paras.push(...richTextParagraphs(summary, font, 20, undefined, {
      ...(theme.bodyJustified ? { alignment: AlignmentType.JUSTIFIED } : {}),
      spacing: { after: 40 },
      keepLines: true,
    }))
  }
  for (const h of highlights) {
    paras.push(new Paragraph({
      children: richTextRuns(h, font, 20),
      bullet: { level: 0 },
      spacing: { after: 20 },
    }))
  }
  return paras
}

// Company/institution header line only — no position and no date, since
// dates now show per-role via roleEntry()/the education role block below,
// not aggregated at the company level.
function companyHeading(name: string, font: string): Paragraph {
  return new Paragraph({
    style: 'Heading2',
    children: [
      new TextRun({ text: name, bold: true, font, size: 22, color: '000000' }),
    ],
    spacing: { before: 150, after: 0 },
    keepNext: true,
  })
}

function roleEntry(
  position: string, dates: string, summary: string | undefined,
  highlights: string[], font: string, theme: DocxTheme, tabWidthTwips: number
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: position, bold: true, font, size: 21, color: theme.accentColor, italics: theme.positionItalics || false }),
        new TextRun({ text: `\t${dates}`, font, size: 20, color: '666666' }),
      ],
      tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
      spacing: { before: 80, after: 0 },
      keepNext: true,
      keepLines: true,
    }),
  ]
  if (summary) {
    paras.push(...richTextParagraphs(summary, font, 20, undefined, {
      ...(theme.bodyJustified ? { alignment: AlignmentType.JUSTIFIED } : {}),
      spacing: { after: 40 },
      keepLines: true,
    }))
  }
  for (const h of highlights) {
    paras.push(new Paragraph({
      children: richTextRuns(h, font, 20),
      bullet: { level: 0 },
      spacing: { after: 20 },
    }))
  }
  return paras
}

function buildRailParas(
  basics: ResumeData['basics'],
  sections: string[],
  data: ResumeData,
  headFont: string,
  bodyFont: string,
  nameSize: number,
  labelSize: number,
): Paragraph[] {
  const railText = 'ffffff'
  const railSoft = 'f2f2f2'
  const railMuted = 'e8e8e8'

  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: basics?.name ?? '', bold: true, font: headFont, size: nameSize, color: railText })],
      spacing: { after: 60 },
    }),
  ]
  if (basics?.label) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: basics.label, font: bodyFont, size: labelSize, color: railMuted })],
      spacing: { after: 40 },
    }))
  }
  const railContactParas: Paragraph[] = []
  const plainItems = [basics?.email, basics?.phone].filter(Boolean) as string[]
  plainItems.forEach((item, idx) => {
    railContactParas.push(new Paragraph({
      children: [new TextRun({ text: item, font: bodyFont, size: 20, color: railSoft })],
      spacing: { before: idx === 0 ? 180 : 0, after: 40 },
    }))
  })
  for (const profile of resolveProfiles(basics)) {
    if (!profile.url) continue
    railContactParas.push(new Paragraph({
      children: [new ExternalHyperlink({
        children: [new TextRun({ text: profile.label || profile.url, font: bodyFont, size: 20, color: railSoft, underline: {} })],
        link: /^https?:\/\//i.test(profile.url) ? profile.url : `https://${profile.url}`,
      })],
      spacing: { after: 40 },
    }))
  }
  const loc = [basics?.location?.city, basics?.location?.region].filter(Boolean).join(', ')
  if (loc) {
    railContactParas.push(new Paragraph({
      children: [new TextRun({ text: loc, font: bodyFont, size: 20, color: railSoft })],
      spacing: { after: 40 },
    }))
  }
  paras.push(...railContactParas)

  const railHeading = (text: string) => new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, font: headFont, size: 24, color: railText })],
    spacing: { before: 270, after: 105 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'd9d9d9', space: 2 } },
  })

  const { work = [], education = [], skills = [], certificates = [], awards = [],
    publications = [], volunteer = [], languages = [], interests = [], projects = [],
    customSections = [] } = data

  for (const section of sections) {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = customSections.find(s => s.id === id)
      if (!cs || !cs.items.length) continue
      paras.push(railHeading(cs.name))
      const csHasRoles = cs.enabledFields.includes('roles')
      for (const item of cs.items) {
        if (item.title) paras.push(new Paragraph({ children: [new TextRun({ text: item.title, bold: true, font: bodyFont, size: 20, color: railText })], spacing: { after: 40 } }))
        if (!csHasRoles && cs.enabledFields.includes('subtitle') && item.subtitle) {
          paras.push(new Paragraph({ children: [new TextRun({ text: item.subtitle, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 40 } }))
        }
        if (!csHasRoles && cs.enabledFields.includes('summary') && item.summary) paras.push(new Paragraph({ children: [new TextRun({ text: item.summary, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 40 } }))
        for (const role of (csHasRoles ? resolveCustomSectionRoles(item) : [])) {
          if (role.title) paras.push(new Paragraph({ children: [new TextRun({ text: role.title, bold: true, font: bodyFont, size: 20, color: railText })], spacing: { after: 30 } }))
          if (cs.enabledFields.includes('subtitle') && role.subtitle) paras.push(new Paragraph({ children: [new TextRun({ text: role.subtitle, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 30 } }))
          if (cs.enabledFields.includes('summary') && role.summary) paras.push(new Paragraph({ children: [new TextRun({ text: role.summary, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 30 } }))
        }
      }
      continue
    }
    switch (section) {
      case 'skills':
        if (!skills.length) break
        paras.push(railHeading('Skills'))
        for (const s of skills) {
          paras.push(new Paragraph({
            children: [new TextRun({ text: s.name ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(s.level ? [new TextRun({ text: ` · ${s.level}`, font: bodyFont, size: 20, color: railMuted })] : [])],
            spacing: { after: (s.keywords ?? []).length ? 0 : 90 },
          }))
          if ((s.keywords ?? []).length) paras.push(new Paragraph({ children: [new TextRun({ text: (s.keywords ?? []).join(', '), font: bodyFont, size: 20, color: railMuted })], spacing: { after: 90 } }))
        }
        break
      case 'languages':
        if (!languages.length) break
        paras.push(railHeading('Languages'))
        for (const l of languages) paras.push(new Paragraph({ children: [new TextRun({ text: l.language ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(l.fluency ? [new TextRun({ text: ` - ${l.fluency}`, font: bodyFont, size: 20, color: railMuted })] : [])], spacing: { after: 30 } }))
        break
      case 'work':
        if (!work.length) break
        paras.push(railHeading('Work Experience'))
        for (const job of work) {
          const roles = resolveWorkRoles(job)
          paras.push(new Paragraph({ children: [new TextRun({ text: job.name ?? '', bold: true, font: bodyFont, size: 20, color: railText })], spacing: { before: 100, after: 20 } }))
          roles.forEach((role, ri) => {
            const roleDates = formatDateRange(role.startDate, role.endDate)
            paras.push(new Paragraph({ children: [new TextRun({ text: role.position ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(roleDates ? [new TextRun({ text: `  ·  ${roleDates}`, font: bodyFont, size: 20, color: railMuted })] : [])], spacing: { before: ri === 0 ? 0 : 60, after: 20 } }))
            for (const h of role.highlights ?? []) paras.push(new Paragraph({ children: richTextRuns(h, bodyFont, 20), bullet: { level: 0 }, spacing: { after: 20 } }))
          })
        }
        break
      case 'education':
        if (!education.length) break
        paras.push(railHeading('Education'))
        for (const edu of education) {
          const roles = resolveEducationRoles(edu)
          paras.push(new Paragraph({ children: [new TextRun({ text: edu.institution ?? '', bold: true, font: bodyFont, size: 20, color: railText })], spacing: { before: 100, after: 20 } }))
          roles.forEach((role) => {
            const roleDegree = [role.studyType, role.area].filter(Boolean).join(' in ')
            const roleDates = formatDateRange(role.startDate, role.endDate)
            if (roleDegree || roleDates) {
              paras.push(new Paragraph({
                children: [
                  new TextRun({ text: roleDegree, font: bodyFont, size: 20, color: railSoft }),
                  ...(roleDates ? [new TextRun({ text: `  ·  ${roleDates}`, font: bodyFont, size: 20, color: railMuted })] : []),
                ],
                spacing: { after: 30 },
              }))
            }
          })
        }
        break
      case 'certificates':
        if (!certificates.length) break
        paras.push(railHeading('Certifications'))
        for (const c of certificates) paras.push(new Paragraph({ children: [new TextRun({ text: c.name ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(c.issuer ? [new TextRun({ text: ` - ${c.issuer}`, font: bodyFont, size: 20, color: railSoft })] : []), ...(c.date ? [new TextRun({ text: `  ·  ${formatDate(c.date)}`, font: bodyFont, size: 20, color: railMuted })] : [])], spacing: { after: 40 } }))
        break
      case 'awards':
        if (!awards.length) break
        paras.push(railHeading('Awards'))
        for (const a of awards) {
          paras.push(new Paragraph({ children: [new TextRun({ text: a.title ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(a.date ? [new TextRun({ text: `  ·  ${formatDate(a.date)}`, font: bodyFont, size: 20, color: railMuted })] : [])], spacing: { before: 80, after: 20 } }))
          if (a.awarder) paras.push(new Paragraph({ children: [new TextRun({ text: a.awarder, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 40 } }))
        }
        break
      case 'publications':
        if (!publications.length) break
        paras.push(railHeading('Publications'))
        for (const p of publications) {
          paras.push(new Paragraph({ children: [new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(p.releaseDate ? [new TextRun({ text: `  ·  ${formatDate(p.releaseDate)}`, font: bodyFont, size: 20, color: railMuted })] : [])], spacing: { before: 80, after: 20 } }))
          if (p.publisher) paras.push(new Paragraph({ children: [new TextRun({ text: p.publisher, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 40 } }))
        }
        break
      case 'volunteer':
        if (!volunteer.length) break
        paras.push(railHeading('Volunteer'))
        for (const v of volunteer) {
          const dates = formatDateRange(v.startDate, v.endDate)
          paras.push(new Paragraph({ children: [new TextRun({ text: v.organization ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(dates ? [new TextRun({ text: `  ·  ${dates}`, font: bodyFont, size: 20, color: railMuted })] : [])], spacing: { before: 100, after: 20 } }))
          if (v.position) paras.push(new Paragraph({ children: [new TextRun({ text: v.position, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 40 } }))
        }
        break
      case 'interests':
        if (!interests.length) break
        paras.push(railHeading('Interests'))
        for (const int of interests) {
          const kw = (int.keywords ?? []).length > 0 ? `: ${(int.keywords ?? []).join(', ')}` : ''
          paras.push(new Paragraph({ children: [new TextRun({ text: int.name ?? '', bold: true, font: bodyFont, size: 20, color: railText }), new TextRun({ text: kw, font: bodyFont, size: 20, color: railMuted })], spacing: { after: 40 } }))
        }
        break
      case 'projects':
        if (!projects.length) break
        paras.push(railHeading('Projects'))
        for (const p of projects) {
          const dates = formatDateRange(p.startDate, p.endDate)
          paras.push(new Paragraph({ children: [new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 20, color: railText }), ...(dates ? [new TextRun({ text: `  ·  ${dates}`, font: bodyFont, size: 20, color: railMuted })] : [])], spacing: { before: 80, after: 20 } }))
          if (p.description) paras.push(new Paragraph({ children: [new TextRun({ text: p.description, font: bodyFont, size: 20, color: railSoft })], spacing: { after: 40 } }))
          for (const h of p.highlights ?? []) paras.push(new Paragraph({ children: richTextRuns(h, bodyFont, 20), bullet: { level: 0 }, spacing: { after: 20 } }))
        }
        break
    }
  }

  return paras
}

interface SectionRenderCtx {
  data: ResumeData
  bodyFont: string
  headFont: string
  theme: DocxTheme
  tabWidthTwips: number
  ensureHttps: (u: string) => string
}

function buildSectionParas(sections: string[], ctx: SectionRenderCtx): Paragraph[] {
  const { data, bodyFont, headFont, theme, tabWidthTwips, ensureHttps } = ctx
  const { work = [], education = [], skills = [], certificates = [], awards = [],
    publications = [], volunteer = [], languages = [], interests = [], projects = [],
    customSections = [] } = data
  const out: Paragraph[] = []

  for (const section of sections) {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = customSections.find((s) => s.id === id)
      if (!cs || !cs.items.length) continue
      out.push(sectionHeading(cs.name, headFont, theme))
      const csHasRoles = cs.enabledFields.includes('roles')
      for (const item of cs.items) {
        const roles = csHasRoles ? resolveCustomSectionRoles(item) : []
        if (item.title) {
          const dateText = !csHasRoles && cs.enabledFields.includes('dateRange')
            ? formatDateRange(item.startDate, item.endDate)
            : ''
          out.push(new Paragraph({
            children: [
              new TextRun({ text: item.title, bold: true, font: bodyFont, size: 22 }),
              ...(dateText ? [new TextRun({ text: `\t${dateText}`, font: bodyFont, size: 20, color: '666666' })] : []),
            ],
            tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
            spacing: { before: 100 },
          }))
        }
        if (!csHasRoles && cs.enabledFields.includes('subtitle') && item.subtitle) {
          out.push(new Paragraph({ children: [new TextRun({ text: item.subtitle, font: bodyFont, size: 21, color: theme.accentColor })], spacing: { after: 40 } }))
        }
        if (cs.enabledFields.includes('url') && item.url) {
          out.push(new Paragraph({
            children: [new ExternalHyperlink({ children: [new TextRun({ text: item.url, font: bodyFont, size: 18, color: '0066cc', underline: {} })], link: ensureHttps(item.url) })],
            spacing: { after: 20 },
          }))
        }
        if (!csHasRoles && cs.enabledFields.includes('summary') && item.summary) {
          out.push(...richTextParagraphs(item.summary, bodyFont, 20, undefined, { spacing: { after: 40 } }))
        }
        for (const h of (!csHasRoles && cs.enabledFields.includes('highlights') ? (item.highlights ?? []) : [])) {
          out.push(new Paragraph({ children: richTextRuns(h, bodyFont, 20), bullet: { level: 0 }, spacing: { after: 20 } }))
        }
        if (!csHasRoles && cs.enabledFields.includes('keywords') && (item.keywords ?? []).length > 0) {
          out.push(new Paragraph({ children: [new TextRun({ text: (item.keywords ?? []).join(' · '), font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
        }
        if (!csHasRoles && cs.enabledFields.includes('level') && item.level) {
          out.push(new Paragraph({ children: [new TextRun({ text: `Level: ${item.level}`, font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
        }
        roles.forEach((role, ri) => {
          const roleDateText = cs.enabledFields.includes('dateRange') && (role.startDate || role.endDate)
            ? formatDateRange(role.startDate, role.endDate)
            : ''
          if (role.title) {
            out.push(new Paragraph({
              children: [
                new TextRun({ text: role.title, bold: true, font: bodyFont, size: 21 }),
                ...(roleDateText ? [new TextRun({ text: `\t${roleDateText}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
              spacing: { before: ri === 0 ? 0 : 60 },
            }))
          }
          if (cs.enabledFields.includes('subtitle') && role.subtitle) {
            out.push(new Paragraph({ children: [new TextRun({ text: role.subtitle, font: bodyFont, size: 20, color: theme.accentColor })], spacing: { after: 30 } }))
          }
          if (cs.enabledFields.includes('summary') && role.summary) {
            out.push(...richTextParagraphs(role.summary, bodyFont, 20, undefined, { spacing: { after: 30 } }))
          }
          for (const h of (cs.enabledFields.includes('highlights') ? (role.highlights ?? []) : [])) {
            out.push(new Paragraph({ children: richTextRuns(h, bodyFont, 20), bullet: { level: 0 }, spacing: { after: 20 } }))
          }
          if (cs.enabledFields.includes('keywords') && (role.keywords ?? []).length > 0) {
            out.push(new Paragraph({ children: [new TextRun({ text: (role.keywords ?? []).join(' · '), font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
          }
          if (cs.enabledFields.includes('level') && role.level) {
            out.push(new Paragraph({ children: [new TextRun({ text: `Level: ${role.level}`, font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
          }
        })
      }
      continue
    }

    switch (section) {
      case 'work':
        if (!work.length) break
        out.push(sectionHeading('Work Experience', headFont, theme))
        for (const job of work) {
          const roles = resolveWorkRoles(job)
          out.push(companyHeading(job.name ?? '', bodyFont))
          for (const role of roles) {
            out.push(...roleEntry(role.position ?? '', formatDateRange(role.startDate, role.endDate), role.summary, role.highlights ?? [], bodyFont, theme, tabWidthTwips))
          }
        }
        break
      case 'education':
        if (!education.length) break
        out.push(sectionHeading('Education', headFont, theme))
        for (const edu of education) {
          const roles = resolveEducationRoles(edu)
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: edu.institution ?? '', bold: true, font: bodyFont, size: 22 }),
              ],
              spacing: { before: 100 },
            })
          )
          roles.forEach((role, ri) => {
            const roleDates = formatDateRange(role.startDate, role.endDate)
            out.push(
              new Paragraph({
                children: [
                  new TextRun({ text: [role.studyType, role.area].filter(Boolean).join(' in '), bold: true, font: bodyFont, size: 21 }),
                  new TextRun({ text: `\t${roleDates}`, font: bodyFont, size: 20, color: '666666' }),
                ],
                tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
                spacing: { before: ri === 0 ? 0 : 60, after: role.score ? 20 : 60 },
              }),
              ...(role.score ? [new Paragraph({ children: [new TextRun({ text: `Score: ${role.score}`, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 60 } })] : [])
            )
          })
        }
        break
      case 'skills':
        if (!skills.length) break
        out.push(sectionHeading('Skills', headFont, theme))
        // Mirrors the web definition list (130px name column + keywords). Word has no
        // flex columns without layout tables (not ATS-safe), so a left tab stop at the
        // keyword column start (146px ≈ 2190 twips) is the closest native equivalent.
        for (const s of skills) {
          const runs = [
            new TextRun({ text: s.name ?? '', bold: true, font: bodyFont, size: 20 }),
            ...(s.level ? [new TextRun({ text: ` · ${s.level}`, font: bodyFont, size: 20, color: '666666' })] : []),
          ]
          if ((s.keywords ?? []).length > 0) {
            runs.push(new TextRun({ text: `\t${(s.keywords ?? []).join(', ')}`, font: bodyFont, size: 20, color: '444444' }))
          }
          out.push(new Paragraph({
            children: runs,
            tabStops: [{ type: 'left' as never, position: 2190 }],
            spacing: { after: 40 },
          }))
        }
        break
      case 'certificates':
        if (!certificates.length) break
        out.push(sectionHeading('Certifications', headFont, theme))
        for (const c of certificates) {
          out.push(new Paragraph({
            children: [
              new TextRun({ text: c.name ?? '', bold: true, font: bodyFont, size: 20 }),
              ...(c.issuer ? [new TextRun({ text: ` - ${c.issuer}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ...(c.date ? [new TextRun({ text: `\t${formatDate(c.date)}`, font: bodyFont, size: 20, color: '666666' })] : []),
            ],
            tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
            spacing: { after: 40 },
          }))
        }
        break
      case 'languages':
        if (!languages.length) break
        out.push(sectionHeading('Languages', headFont, theme))
        for (const l of languages) {
          out.push(new Paragraph({
            children: [
              new TextRun({ text: l.language ?? '', bold: true, font: bodyFont, size: 20 }),
              ...(l.fluency ? [new TextRun({ text: ` - ${l.fluency}`, font: bodyFont, size: 20, color: '666666' })] : []),
            ],
            spacing: { after: 40 },
          }))
        }
        break
      case 'awards':
        if (!awards.length) break
        out.push(sectionHeading('Awards', headFont, theme))
        for (const a of awards) {
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: a.title ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(a.date ? [new TextRun({ text: `\t${formatDate(a.date)}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
              spacing: { before: 100 },
            }),
            ...(a.awarder ? [new Paragraph({ children: [new TextRun({ text: a.awarder, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 20 } })] : []),
            ...(a.summary ? richTextParagraphs(a.summary, bodyFont, 20, undefined, { spacing: { after: 80 } }) : [])
          )
        }
        break
      case 'publications':
        if (!publications.length) break
        out.push(sectionHeading('Publications', headFont, theme))
        for (const p of publications) {
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(p.releaseDate ? [new TextRun({ text: `\t${formatDate(p.releaseDate)}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
              spacing: { before: 100 },
            }),
            ...(p.publisher ? [new Paragraph({ children: [new TextRun({ text: p.publisher, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 20 } })] : []),
            ...(p.summary ? richTextParagraphs(p.summary, bodyFont, 20, undefined, { spacing: { after: 80 } }) : [])
          )
        }
        break
      case 'volunteer':
        if (!volunteer.length) break
        out.push(sectionHeading('Volunteer', headFont, theme))
        for (const v of volunteer) {
          const dates = formatDateRange(v.startDate, v.endDate)
          out.push(...jobEntry(v.organization ?? '', v.position ?? '', dates, v.summary, v.highlights ?? [], bodyFont, theme, tabWidthTwips))
        }
        break
      case 'interests':
        if (!interests.length) break
        out.push(sectionHeading('Interests', headFont, theme))
        for (const int of interests) {
          const kw = (int.keywords ?? []).length > 0 ? `: ${(int.keywords ?? []).join(', ')}` : ''
          out.push(new Paragraph({
            children: [
              new TextRun({ text: int.name ?? '', bold: true, font: bodyFont, size: 20 }),
              new TextRun({ text: kw, font: bodyFont, size: 20, color: '555555' }),
            ],
            spacing: { after: 40 },
          }))
        }
        break
      case 'projects':
        if (!projects.length) break
        out.push(sectionHeading('Projects', headFont, theme))
        for (const p of projects) {
          const dates = formatDateRange(p.startDate, p.endDate)
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(dates ? [new TextRun({ text: `\t${dates}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
              spacing: { before: 100 },
            }),
            ...(p.description ? [new Paragraph({ children: [new TextRun({ text: p.description, font: bodyFont, size: 20 })], spacing: { after: 40 } })] : []),
            ...(p.highlights ?? []).map(h => new Paragraph({
              children: richTextRuns(h, bodyFont, 20),
              bullet: { level: 0 },
              spacing: { after: 20 },
            })),
            ...((p.keywords ?? []).length > 0 ? [new Paragraph({ children: [new TextRun({ text: (p.keywords ?? []).join(', '), font: bodyFont, size: 18, color: '666666' })], spacing: { after: 80 } })] : [])
          )
        }
        break
    }
  }

  return out
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }

export function buildDocx(data: ResumeData, meta: ResumeMeta, mode: ExportMode = 'designed'): Document {
  const bodyFont = mapFont(meta.fontFamily)
  const headFont = mapFont(meta.headerFontFamily)
  const marginTwips = convertInchesToTwip(meta.pageMargins)
  const lineRule = 'auto' as never
  const lineVal = Math.round(meta.lineSpacing * 240)

  const { basics = {} } = data

  const DEFAULT_ORDER = ['work', 'education', 'skills', 'volunteer', 'languages']
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_ORDER

  const theme = mode === 'ats' ? buildAtsDocxTheme(meta) : buildDocxTheme(meta)
  const headerShading = theme.headerFill
    ? { type: ShadingType.CLEAR, fill: theme.headerFill, color: 'auto' as const }
    : undefined
  const headerShadingProps = headerShading ? { shading: headerShading } : {}
  const onHeaderFill = !!headerShading
  const subtleColor = onHeaderFill ? '#f1f5f9' : '#555555'
  const contactColor = onHeaderFill ? subtleColor : (theme.contactColor ?? '#555555')
  // Web header links inherit the muted text color with no underline; keep white + underline only on filled headers for contrast
  const linkColor = onHeaderFill ? '#ffffff' : contactColor
  const linkUnderline = onHeaderFill ? {} : undefined
  const nameProps = onHeaderFill ? { color: '#ffffff' } : (theme.nameColor ? { color: theme.nameColor } : {})

  // A4 page width in twips; usable = page - left margin - right margin
  const pageWidthTwips = convertInchesToTwip(8.27)
  const usableWidthTwips = pageWidthTwips - 2 * marginTwips

  const ensureHttps = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`

  const docxStyles = buildDocxStyles(theme, headFont, bodyFont)
  const makeDocument = (children: (Paragraph | Table)[]) => new Document({
    styles: {
      default: {
        // buildDocxStyles returns only `default` — it overrides docx's built-in
        // Title/Heading1/Heading2 rather than declaring new paragraphStyles,
        // because declaring ids the library already injects emits duplicate
        // <w:style> elements. Spreading it above this key would therefore be
        // dead code, not a merge.
        ...docxStyles.default,
        document: {
          run: { font: bodyFont, size: 22 },
          paragraph: { spacing: { line: lineVal, lineRule } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: marginTwips, bottom: marginTwips,
            left: marginTwips, right: marginTwips,
          },
        },
      },
      children,
    }],
  })

  // ─── Sidebar template: shaded left rail + main column ───
  // Uses columnAssignment (with SIDEBAR_COLUMN_DEFAULTS) so users can assign any
  // section to either column. Rail cell is shaded with meta.primaryColor.
  if (mode === 'designed' && meta.templateId === 'sidebar') {
    const ca = meta.columnAssignment ?? {}
    const leftSections  = sectionOrder.filter(s => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'left')
    const rightSections = sectionOrder.filter(s => getColumnSide(s, ca, SIDEBAR_COLUMN_DEFAULTS) === 'right')

    const railWidthTwips = Math.round(usableWidthTwips * ((meta.sidebarRailWidth ?? 33) / 100))
    const mainWidthTwips = usableWidthTwips - railWidthTwips
    const railPad = 220
    const mainGap = 360

    const leftCellChildren = buildRailParas(basics, leftSections, data, headFont, bodyFont, theme.nameSize, theme.labelSize ?? 21)

    const rightParas: Paragraph[] = []
    if (basics.summary) {
      rightParas.push(...richTextParagraphs(basics.summary, bodyFont, 20, { color: '444444' }, {
        spacing: { after: 90 },
      }))
    }
    rightParas.push(...buildSectionParas(rightSections, {
      data, bodyFont, headFont, theme, ensureHttps,
      tabWidthTwips: mainWidthTwips - mainGap,
    }))

    return makeDocument([
      new Table({
        width: { size: usableWidthTwips, type: WidthType.DXA },
        borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: railWidthTwips, type: WidthType.DXA },
                borders: NO_BORDERS,
                shading: { type: ShadingType.CLEAR, fill: meta.primaryColor, color: 'auto' },
                margins: { top: railPad, bottom: railPad, left: railPad, right: railPad },
                children: leftCellChildren.length ? leftCellChildren : [new Paragraph({})],
              }),
              new TableCell({
                width: { size: mainWidthTwips, type: WidthType.DXA },
                borders: NO_BORDERS,
                margins: { left: mainGap, right: 0, top: 0, bottom: 0 },
                children: rightParas.length ? rightParas : [new Paragraph({})],
              }),
            ],
          }),
        ],
      }),
    ])
  }

  // Build header paragraphs (full-width, above any column split)
  const headerParas: Paragraph[] = []
  headerParas.push(
    new Paragraph({
      style: 'Title',
      children: [new TextRun({ text: basics.name ?? '', bold: true, font: headFont, ...nameProps })],
      alignment: theme.headerAlign,
      spacing: { after: 60 },
      ...headerShadingProps,
    })
  )
  if (basics.label) {
    headerParas.push(new Paragraph({
      children: [new TextRun({ text: basics.label, font: bodyFont, size: theme.labelSize ?? 24, color: theme.labelColor ?? subtleColor, italics: theme.labelItalics || false })],
      alignment: theme.headerAlign,
      spacing: { after: 40 },
      ...headerShadingProps,
    }))
  }
  if (theme.headerRule) {
    // Decorative double rule under the name — a paragraph border keeps it ATS-safe
    headerParas.push(new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.DOUBLE, size: 12, color: theme.sectionTitleColor, space: 2 } },
      spacing: { after: 100 },
    }))
  }
  const sep = () => new TextRun({ text: theme.contactSeparator ?? ' · ', font: bodyFont, size: 20, color: contactColor })
  const contactRuns: (TextRun | ExternalHyperlink)[] = []
  if (basics.email) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new ExternalHyperlink({ children: [new TextRun({ text: basics.email, font: bodyFont, size: 20, color: linkColor, underline: linkUnderline })], link: `mailto:${basics.email}` }))
  }
  if (basics.phone) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new TextRun({ text: basics.phone, font: bodyFont, size: 20, color: contactColor }))
  }
  for (const profile of resolveProfiles(basics)) {
    if (!profile.url) continue
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new ExternalHyperlink({
      children: [new TextRun({ text: profile.label || profile.url, font: bodyFont, size: 20, color: linkColor, underline: linkUnderline })],
      link: ensureHttps(profile.url),
    }))
  }
  const contactLocation = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  if (contactLocation) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new TextRun({ text: contactLocation, font: bodyFont, size: 20, color: contactColor }))
  }
  if (contactRuns.length) {
    headerParas.push(new Paragraph({
      children: contactRuns,
      alignment: theme.headerAlign,
      spacing: { after: 120 },
      ...headerShadingProps,
    }))
  }
  if (basics.summary) {
    if (!theme.summaryHeading) {
      // Web modern/minimal/executive show the summary as plain body text without a heading
      headerParas.push(...richTextParagraphs(basics.summary, bodyFont, theme.summarySize ?? 20, theme.summaryColor ? { color: theme.summaryColor } : undefined, {
        ...(theme.summaryJustified ? { alignment: AlignmentType.JUSTIFIED } : {}),
        spacing: { after: 180 },
      }))
    } else if (mode === 'designed' && meta.layout === 'two-column') {
      // Web two-column shows the summary italic under the header, without a heading
      headerParas.push(...richTextParagraphs(basics.summary, bodyFont, 20, { italics: true }, {
        spacing: { after: 180 },
      }))
    } else {
      headerParas.push(sectionHeading('Summary', headFont, theme))
      headerParas.push(...richTextParagraphs(basics.summary, bodyFont, 20, undefined, {
        spacing: { after: 80 },
      }))
    }
  }

  // Build body (single- or two-column). Minimal is single-column only — a
  // previously saved resume may still carry a stale two-column layout.
  let bodyContent: (Paragraph | Table)[]

  if (mode === 'designed' && meta.layout === 'two-column' && meta.templateId !== 'minimal') {
    const ca = meta.columnAssignment ?? {}
    const leftSections = sectionOrder.filter(s => getColumnSide(s, ca) === 'left')
    const rightSections = sectionOrder.filter(s => getColumnSide(s, ca) === 'right')

    // Column widths mirror the web's 58% / 42% split with a 24px (0.25in) gap
    const colGapTwips = convertInchesToTwip(0.25)
    const leftWidthTwips = Math.round(usableWidthTwips * 0.58)
    const rightWidthTwips = usableWidthTwips - leftWidthTwips - colGapTwips

    const leftParas = buildSectionParas(leftSections, {
      data, bodyFont, headFont, theme, ensureHttps,
      tabWidthTwips: leftWidthTwips,
    })
    const rightParas = buildSectionParas(rightSections, {
      data, bodyFont, headFont, theme, ensureHttps,
      tabWidthTwips: rightWidthTwips,
    })

    // Cells must have at least one child paragraph — add an empty one if empty
    const leftChildren = leftParas.length ? leftParas : [new Paragraph({})]
    const rightChildren = rightParas.length ? rightParas : [new Paragraph({})]

    // Two-column layout via a single-row borderless table. This is a flat,
    // non-nested layout table — not a "nested layout table" — so ATS parsers
    // read each cell sequentially: left top-to-bottom, then right top-to-bottom.
    bodyContent = [
      new Table({
        width: { size: usableWidthTwips, type: WidthType.DXA },
        borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: leftWidthTwips, type: WidthType.DXA },
                borders: NO_BORDERS,
                children: leftChildren,
              }),
              new TableCell({
                width: { size: rightWidthTwips, type: WidthType.DXA },
                borders: NO_BORDERS,
                margins: { left: colGapTwips, right: 0, top: 0, bottom: 0 },
                children: rightChildren,
              }),
            ],
          }),
        ],
      }),
    ]
  } else {
    bodyContent = buildSectionParas(sectionOrder, {
      data, bodyFont, headFont, theme, ensureHttps,
      tabWidthTwips: usableWidthTwips,
    })
  }

  return makeDocument([...headerParas, ...bodyContent])
}
