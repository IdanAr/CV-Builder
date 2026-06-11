import {
  Document, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ShadingType, WidthType, convertInchesToTwip,
} from 'docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { parseRichText, TextRun as RichTextRun } from '@/lib/rich-text'
import { getColumnSide } from '@/lib/get-column-side'
import { formatDate } from '@/lib/format-date'

function richTextRuns(
  text: string,
  font: string,
  size: number,
  extraProps?: Partial<{ bold: boolean; color: string; italics: boolean }>
): TextRun[] {
  const runs: RichTextRun[] = parseRichText(text)
  return runs.map(run => new TextRun({
    text: run.text,
    font,
    size,
    bold: run.bold || extraProps?.bold || false,
    italics: run.italic || extraProps?.italics || false,
    underline: run.underline ? {} : undefined,
    ...(extraProps?.color ? { color: extraProps.color } : {}),
  }))
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
      // Web executive: left-aligned header with primary-color 26pt name, double rule,
      // italic accent label/positions, justified 10.5pt summary without a heading
      return {
        sectionTitleColor: meta.primaryColor,
        sectionUppercase: true,
        sectionBorder: true,
        sectionBorderSize: 6, // 1px web rule
        accentColor: meta.accentColor,
        nameSize: 52,
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

function sectionHeading(text: string, font: string, theme: DocxTheme): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text: theme.sectionUppercase ? text.toUpperCase() : text,
      bold: true, font, size: theme.headingSize, color: theme.sectionTitleColor,
    })],
    // Web section titles: 18px top / 8px bottom margins, 1.5px underline
    spacing: { before: 270, after: 120 },
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
      children: [
        new TextRun({ text: name, bold: true, font, size: 22 }),
        new TextRun({ text: `\t${dates}`, font, size: 20, color: '666666' }),
      ],
      tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
      spacing: { before: 150 },
    }),
    new Paragraph({
      children: [new TextRun({ text: position, font, size: 21, color: theme.accentColor, italics: theme.positionItalics || false })],
      spacing: { after: 40 },
    }),
  ]
  if (summary) {
    paras.push(new Paragraph({
      children: richTextRuns(summary, font, 20),
      ...(theme.bodyJustified ? { alignment: AlignmentType.JUSTIFIED } : {}),
      spacing: { after: 40 },
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
      for (const item of cs.items) {
        if (item.title) {
          const dateText = cs.enabledFields.includes('dateRange') && (item.startDate || item.endDate)
            ? [formatDate(item.startDate), formatDate(item.endDate)].filter(Boolean).join(' – ')
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
        if (cs.enabledFields.includes('subtitle') && item.subtitle) {
          out.push(new Paragraph({ children: [new TextRun({ text: item.subtitle, font: bodyFont, size: 21, color: theme.accentColor })], spacing: { after: 40 } }))
        }
        if (cs.enabledFields.includes('url') && item.url) {
          out.push(new Paragraph({
            children: [new ExternalHyperlink({ children: [new TextRun({ text: item.url, font: bodyFont, size: 18, color: '0066cc', underline: {} })], link: ensureHttps(item.url) })],
            spacing: { after: 20 },
          }))
        }
        if (cs.enabledFields.includes('summary') && item.summary) {
          out.push(new Paragraph({ children: richTextRuns(item.summary, bodyFont, 20), spacing: { after: 40 } }))
        }
        for (const h of (cs.enabledFields.includes('highlights') ? (item.highlights ?? []) : [])) {
          out.push(new Paragraph({ children: richTextRuns(h, bodyFont, 20), bullet: { level: 0 }, spacing: { after: 20 } }))
        }
        if (cs.enabledFields.includes('keywords') && (item.keywords ?? []).length > 0) {
          out.push(new Paragraph({ children: [new TextRun({ text: (item.keywords ?? []).join(' · '), font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
        }
        if (cs.enabledFields.includes('level') && item.level) {
          out.push(new Paragraph({ children: [new TextRun({ text: `Level: ${item.level}`, font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
        }
      }
      continue
    }

    switch (section) {
      case 'work':
        if (!work.length) break
        out.push(sectionHeading('Work Experience', headFont, theme))
        for (const job of work) {
          const dates = [formatDate(job.startDate), formatDate(job.endDate) || 'Present'].filter(Boolean).join(' – ')
          out.push(...jobEntry(job.name ?? '', job.position ?? '', dates, job.summary, job.highlights ?? [], bodyFont, theme, tabWidthTwips))
        }
        break
      case 'education':
        if (!education.length) break
        out.push(sectionHeading('Education', headFont, theme))
        for (const edu of education) {
          const dates = [formatDate(edu.startDate), formatDate(edu.endDate)].filter(Boolean).join(' – ')
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: edu.institution ?? '', bold: true, font: bodyFont, size: 22 }),
                new TextRun({ text: `\t${dates}`, font: bodyFont, size: 20, color: '666666' }),
              ],
              tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
              spacing: { before: 100 },
            }),
            new Paragraph({
              children: [new TextRun({ text: [edu.studyType, edu.area].filter(Boolean).join(' in '), font: bodyFont, size: 21 })],
              spacing: { after: edu.score ? 20 : 80 },
            }),
            ...(edu.score ? [new Paragraph({ children: [new TextRun({ text: `Score: ${edu.score}`, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 80 } })] : [])
          )
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
              ...(c.issuer ? [new TextRun({ text: ` — ${c.issuer}`, font: bodyFont, size: 20, color: '666666' })] : []),
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
              ...(l.fluency ? [new TextRun({ text: ` – ${l.fluency}`, font: bodyFont, size: 20, color: '666666' })] : []),
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
            ...(a.summary ? [new Paragraph({ children: richTextRuns(a.summary, bodyFont, 20), spacing: { after: 80 } })] : [])
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
            ...(p.summary ? [new Paragraph({ children: richTextRuns(p.summary, bodyFont, 20), spacing: { after: 80 } })] : [])
          )
        }
        break
      case 'volunteer':
        if (!volunteer.length) break
        out.push(sectionHeading('Volunteer', headFont, theme))
        for (const v of volunteer) {
          const dates = [formatDate(v.startDate), formatDate(v.endDate) || 'Present'].filter(Boolean).join(' – ')
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
          const dates = [formatDate(p.startDate), formatDate(p.endDate)].filter(Boolean).join(' – ')
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

export function buildDocx(data: ResumeData, meta: ResumeMeta): Document {
  const bodyFont = mapFont(meta.fontFamily)
  const headFont = mapFont(meta.headerFontFamily)
  const marginTwips = convertInchesToTwip(meta.pageMargins)
  const lineRule = 'auto' as never
  const lineVal = Math.round(meta.lineSpacing * 240)

  const { basics = {}, customSections = [] } = data

  const DEFAULT_ORDER = ['work', 'education', 'skills', 'volunteer', 'languages']
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_ORDER

  const theme = buildDocxTheme(meta)
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

  const makeDocument = (children: (Paragraph | Table)[]) => new Document({
    styles: {
      default: {
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
  // Mirrors the web's colored rail with a single-row, two-cell layout table: the
  // rail cell is shaded with the primary color and holds the name, contact,
  // skills and languages; the main cell holds the summary and remaining sections.
  // A flat (non-nested) table keeps the ATS reading order linear — rail
  // top-to-bottom, then main column. The sidebar has its own two-column
  // structure, so meta.layout is ignored here, matching the web preview.
  if (meta.templateId === 'sidebar') {
    const railSet = new Set(['skills', 'languages'])
    const mainSections = sectionOrder.filter(s => s.startsWith('custom:') || !railSet.has(s))
    const { skills = [], languages = [] } = data

    // Web rail text is white at 0.85–0.9 opacity; DOCX has no opacity, so fixed
    // light tints are the closest flat equivalents on the dark fill.
    const railText = 'ffffff'
    const railSoft = 'f2f2f2'   // opacity 0.9
    const railMuted = 'e8e8e8'  // opacity 0.85

    const railParas: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: basics.name ?? '', bold: true, font: headFont, size: theme.nameSize, color: railText })],
        spacing: { after: 60 },
      }),
    ]
    if (basics.label) {
      railParas.push(new Paragraph({
        children: [new TextRun({ text: basics.label, font: bodyFont, size: theme.labelSize ?? 21, color: railMuted })],
        spacing: { after: 40 },
      }))
    }
    const contactItems = [
      basics.email, basics.phone, basics.url,
      [basics.location?.city, basics.location?.region].filter(Boolean).join(', '),
    ].filter(Boolean) as string[]
    contactItems.forEach((item, i) => {
      railParas.push(new Paragraph({
        // Web rail contact: 9pt, one item per line, 12px gap above the block
        children: [new TextRun({ text: item, font: bodyFont, size: 18, color: railSoft })],
        spacing: { before: i === 0 ? 180 : 0, after: 40 },
      }))
    })

    const railHeading = (text: string) => new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, font: headFont, size: 20, color: railText })],
      spacing: { before: 270, after: 105 },
      // Web: 1px rgba(255,255,255,0.35) underline — flat light tint fallback
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'd9d9d9', space: 2 } },
    })

    if (sectionOrder.includes('skills') && skills.length) {
      railParas.push(railHeading('Skills'))
      for (const s of skills) {
        railParas.push(new Paragraph({
          children: [
            new TextRun({ text: s.name ?? '', bold: true, font: bodyFont, size: 19, color: railText }),
            ...(s.level ? [new TextRun({ text: ` · ${s.level}`, font: bodyFont, size: 19, color: railMuted })] : []),
          ],
          spacing: { after: (s.keywords ?? []).length ? 0 : 90 },
        }))
        if ((s.keywords ?? []).length) {
          railParas.push(new Paragraph({
            children: [new TextRun({ text: (s.keywords ?? []).join(', '), font: bodyFont, size: 19, color: railMuted })],
            spacing: { after: 90 },
          }))
        }
      }
    }
    if (sectionOrder.includes('languages') && languages.length) {
      railParas.push(railHeading('Languages'))
      for (const l of languages) {
        railParas.push(new Paragraph({
          children: [
            new TextRun({ text: l.language ?? '', bold: true, font: bodyFont, size: 19, color: railText }),
            ...(l.fluency ? [new TextRun({ text: ` – ${l.fluency}`, font: bodyFont, size: 19, color: railMuted })] : []),
          ],
          spacing: { after: 30 },
        }))
      }
    }

    // Web rail is 33% of the page; the shaded cell spans content height only —
    // Word cannot full-bleed a background to the page edges within flow content.
    const railWidthTwips = Math.round(usableWidthTwips * 0.33)
    const mainWidthTwips = usableWidthTwips - railWidthTwips
    const railPad = 220   // inner padding inside the shaded rail (~0.15")
    const mainGap = 360   // rail-to-main gap, mirrors the web's column padding (~24px)

    const mainParas: Paragraph[] = []
    if (basics.summary) {
      mainParas.push(new Paragraph({
        children: richTextRuns(basics.summary, bodyFont, 20, { color: '444444' }),
        spacing: { after: 90 },
      }))
    }
    mainParas.push(...buildSectionParas(mainSections, {
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
                children: railParas,
              }),
              new TableCell({
                width: { size: mainWidthTwips, type: WidthType.DXA },
                borders: NO_BORDERS,
                margins: { left: mainGap, right: 0, top: 0, bottom: 0 },
                children: mainParas.length ? mainParas : [new Paragraph({})],
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
      children: [new TextRun({ text: basics.name ?? '', bold: true, font: headFont, size: theme.nameSize, ...nameProps })],
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
  if (basics.url) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new ExternalHyperlink({ children: [new TextRun({ text: basics.url, font: bodyFont, size: 20, color: linkColor, underline: linkUnderline })], link: ensureHttps(basics.url) }))
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
      headerParas.push(new Paragraph({
        children: richTextRuns(basics.summary, bodyFont, theme.summarySize ?? 20, theme.summaryColor ? { color: theme.summaryColor } : undefined),
        ...(theme.summaryJustified ? { alignment: AlignmentType.JUSTIFIED } : {}),
        spacing: { after: 180 },
      }))
    } else if (meta.layout === 'two-column') {
      // Web two-column shows the summary italic under the header, without a heading
      headerParas.push(new Paragraph({
        children: richTextRuns(basics.summary, bodyFont, 20, { italics: true }),
        spacing: { after: 180 },
      }))
    } else {
      headerParas.push(sectionHeading('Summary', headFont, theme))
      headerParas.push(new Paragraph({
        children: richTextRuns(basics.summary, bodyFont, 20),
        spacing: { after: 80 },
      }))
    }
  }

  // Build body (single- or two-column). Minimal is single-column only — a
  // previously saved resume may still carry a stale two-column layout.
  let bodyContent: (Paragraph | Table)[]

  if (meta.layout === 'two-column' && meta.templateId !== 'minimal') {
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
