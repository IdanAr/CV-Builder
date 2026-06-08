import {
  Document, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ShadingType, WidthType, convertInchesToTwip,
} from 'docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { parseRichText, TextRun as RichTextRun } from '@/lib/rich-text'

function richTextRuns(
  text: string,
  font: string,
  size: number,
  extraProps?: Partial<{ bold: boolean; color: string }>
): TextRun[] {
  const runs: RichTextRun[] = parseRichText(text)
  return runs.map(run => new TextRun({
    text: run.text,
    font,
    size,
    bold: run.bold || extraProps?.bold || false,
    italics: run.italic || false,
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
  accentColor: string
  headerFill?: string
}

// Mirrors the visual identity of the matching live-preview/PDF template,
// using only native paragraph styling (shading/borders/color) so the
// DOCX stays ATS-parseable (no text boxes, floating objects, or tables).
function buildDocxTheme(meta: ResumeMeta): DocxTheme {
  switch (meta.templateId) {
    case 'modern':
      return {
        sectionTitleColor: meta.accentColor,
        sectionUppercase: true,
        sectionBorder: false,
        accentColor: meta.accentColor,
        headerFill: meta.primaryColor,
      }
    case 'minimal':
      return {
        sectionTitleColor: '#333333',
        sectionUppercase: true,
        sectionBorder: false,
        accentColor: '#000000',
      }
    default:
      return {
        sectionTitleColor: meta.primaryColor,
        sectionUppercase: false,
        sectionBorder: true,
        accentColor: meta.accentColor,
      }
  }
}

function sectionHeading(text: string, font: string, theme: DocxTheme): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text: theme.sectionUppercase ? text.toUpperCase() : text,
      bold: true, font, size: 26, color: theme.sectionTitleColor,
    })],
    spacing: { before: 200, after: 80 },
    ...(theme.sectionBorder
      ? { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.sectionTitleColor, space: 4 } } }
      : {}),
  })
}

function jobEntry(
  name: string, position: string, dates: string, summary: string | undefined,
  highlights: string[], font: string, accentColor: string, tabWidthTwips: number
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: name, bold: true, font, size: 22 }),
        new TextRun({ text: `\t${dates}`, font, size: 20, color: '666666' }),
      ],
      tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
      spacing: { before: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: position, font, size: 21, color: accentColor })],
      spacing: { after: 40 },
    }),
  ]
  if (summary) {
    paras.push(new Paragraph({ children: richTextRuns(summary, font, 20), spacing: { after: 40 } }))
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
            ? [item.startDate, item.endDate].filter(Boolean).join(' – ')
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
            children: [new ExternalHyperlink({ children: [new TextRun({ text: item.url, font: bodyFont, size: 18, color: '0563C1', underline: {} })], link: ensureHttps(item.url) })],
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
          const dates = [job.startDate, job.endDate || 'Present'].filter(Boolean).join(' – ')
          out.push(...jobEntry(job.name ?? '', job.position ?? '', dates, job.summary, job.highlights ?? [], bodyFont, theme.accentColor, tabWidthTwips))
        }
        break
      case 'education':
        if (!education.length) break
        out.push(sectionHeading('Education', headFont, theme))
        for (const edu of education) {
          const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ')
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
              children: [new TextRun({ text: [edu.studyType, edu.area].filter(Boolean).join(' in '), font: bodyFont, size: 20 })],
              spacing: { after: edu.score ? 20 : 80 },
            }),
            ...(edu.score ? [new Paragraph({ children: [new TextRun({ text: `Score: ${edu.score}`, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 80 } })] : [])
          )
        }
        break
      case 'skills':
        if (!skills.length) break
        out.push(sectionHeading('Skills', headFont, theme))
        for (const s of skills) {
          const kw = (s.keywords ?? []).length > 0 ? `: ${(s.keywords ?? []).join(', ')}` : ''
          const level = s.level ? ` (${s.level})` : ''
          out.push(new Paragraph({
            children: [
              new TextRun({ text: s.name ?? '', bold: true, font: bodyFont, size: 20 }),
              new TextRun({ text: level, font: bodyFont, size: 20, color: '666666' }),
              new TextRun({ text: kw, font: bodyFont, size: 20, color: '555555' }),
            ],
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
              ...(c.date ? [new TextRun({ text: `\t${c.date}`, font: bodyFont, size: 20, color: '666666' })] : []),
            ],
            tabStops: [{ type: 'right' as never, position: tabWidthTwips }],
            spacing: { after: 40 },
          }))
        }
        break
      case 'languages':
        if (!languages.length) break
        out.push(sectionHeading('Languages', headFont, theme))
        out.push(new Paragraph({
          children: languages.flatMap((l, i) => [
            new TextRun({ text: l.language ?? '', bold: true, font: bodyFont, size: 20 }),
            ...(l.fluency ? [new TextRun({ text: ` (${l.fluency})`, font: bodyFont, size: 20, color: '666666' })] : []),
            ...(i < languages.length - 1 ? [new TextRun({ text: '  ·  ', font: bodyFont, size: 20 })] : []),
          ]),
          spacing: { after: 80 },
        }))
        break
      case 'awards':
        if (!awards.length) break
        out.push(sectionHeading('Awards', headFont, theme))
        for (const a of awards) {
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: a.title ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(a.date ? [new TextRun({ text: `\t${a.date}`, font: bodyFont, size: 20, color: '666666' })] : []),
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
                ...(p.releaseDate ? [new TextRun({ text: `\t${p.releaseDate}`, font: bodyFont, size: 20, color: '666666' })] : []),
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
          const dates = [v.startDate, v.endDate || 'Present'].filter(Boolean).join(' – ')
          out.push(...jobEntry(v.organization ?? '', v.position ?? '', dates, v.summary, v.highlights ?? [], bodyFont, theme.accentColor, tabWidthTwips))
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
          const dates = [p.startDate, p.endDate].filter(Boolean).join(' – ')
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
  const linkColor = onHeaderFill ? '#ffffff' : '#0563C1'
  const nameProps = onHeaderFill ? { color: '#ffffff' } : {}

  // A4 page width in twips; usable = page - left margin - right margin
  const pageWidthTwips = convertInchesToTwip(8.27)
  const usableWidthTwips = pageWidthTwips - 2 * marginTwips

  const ensureHttps = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`

  // Build header paragraphs (full-width, above any column split)
  const headerParas: Paragraph[] = []
  headerParas.push(
    new Paragraph({
      children: [new TextRun({ text: basics.name ?? '', bold: true, font: headFont, size: 40, ...nameProps })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      ...headerShadingProps,
    })
  )
  if (basics.label) {
    headerParas.push(new Paragraph({
      children: [new TextRun({ text: basics.label, font: bodyFont, size: 24, color: subtleColor })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      ...headerShadingProps,
    }))
  }
  const sep = () => new TextRun({ text: ' · ', font: bodyFont, size: 20, color: subtleColor })
  const contactRuns: (TextRun | ExternalHyperlink)[] = []
  if (basics.email) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new ExternalHyperlink({ children: [new TextRun({ text: basics.email, font: bodyFont, size: 20, color: linkColor, underline: {} })], link: `mailto:${basics.email}` }))
  }
  if (basics.phone) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new TextRun({ text: basics.phone, font: bodyFont, size: 20, color: subtleColor }))
  }
  if (basics.url) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new ExternalHyperlink({ children: [new TextRun({ text: basics.url, font: bodyFont, size: 20, color: linkColor, underline: {} })], link: ensureHttps(basics.url) }))
  }
  const contactLocation = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  if (contactLocation) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new TextRun({ text: contactLocation, font: bodyFont, size: 20, color: subtleColor }))
  }
  if (contactRuns.length) {
    headerParas.push(new Paragraph({
      children: contactRuns,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      ...headerShadingProps,
    }))
  }
  if (basics.summary) {
    headerParas.push(sectionHeading('Summary', headFont, theme))
    headerParas.push(new Paragraph({
      children: richTextRuns(basics.summary, bodyFont, 20),
      spacing: { after: 80 },
    }))
  }

  // Build body (single- or two-column)
  let bodyContent: (Paragraph | Table)[]

  if (meta.layout === 'two-column') {
    const leftBuiltIn = ['work', 'education', 'volunteer']
    const leftSections = sectionOrder.filter(s => leftBuiltIn.includes(s) || s.startsWith('custom:'))
    const rightSections = sectionOrder.filter(s => !leftBuiltIn.includes(s) && !s.startsWith('custom:'))

    // Column widths mirror the PDF's flex: 0.58 / 0.42
    const colGapTwips = convertInchesToTwip(0.15)
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

  return new Document({
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
      children: [...headerParas, ...bodyContent],
    }],
  })
}
