import {
  Document, Paragraph, TextRun, ExternalHyperlink,
  AlignmentType, BorderStyle, convertInchesToTwip,
} from 'docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

function mapFont(font: string): string {
  const map: Record<string, string> = {
    'Lato': 'Arial',
    'Roboto': 'Arial',
    'IBM Plex Sans': 'Calibri',
    'Helvetica': 'Arial',
  }
  return map[font] ?? font
}

function sectionHeading(text: string, font: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, font, size: 26 })],
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
  })
}

function jobEntry(
  name: string, position: string, dates: string, summary: string | undefined,
  highlights: string[], font: string
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: name, bold: true, font, size: 22 }),
        new TextRun({ text: `\t${dates}`, font, size: 20, color: '666666' }),
      ],
      tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
      spacing: { before: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: position, font, size: 21, color: '0066cc' })],
      spacing: { after: 40 },
    }),
  ]
  if (summary) {
    paras.push(new Paragraph({ children: [new TextRun({ text: summary, font, size: 20 })], spacing: { after: 40 } }))
  }
  for (const h of highlights) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: h, font, size: 20 })],
      bullet: { level: 0 },
      spacing: { after: 20 },
    }))
  }
  return paras
}

export function buildDocx(data: ResumeData, meta: ResumeMeta): Document {
  const bodyFont = mapFont(meta.fontFamily)
  const headFont = mapFont(meta.headerFontFamily)
  const marginTwips = convertInchesToTwip(meta.pageMargins)
  const lineRule = 'auto' as never
  const lineVal = Math.round(meta.lineSpacing * 240)

  const { basics = {}, work = [], education = [], skills = [],
    certificates = [], awards = [], publications = [],
    volunteer = [], languages = [], interests = [], projects = [],
    customSections = [] } = data

  const DEFAULT_ORDER = ['work', 'education', 'skills', 'volunteer', 'languages']
  const sectionOrder = meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_ORDER

  const leftBuiltIn = ['work', 'education', 'volunteer']
  const orderedSections = meta.layout === 'two-column'
    ? [
        ...sectionOrder.filter(s => leftBuiltIn.includes(s) || s.startsWith('custom:')),
        ...sectionOrder.filter(s => !leftBuiltIn.includes(s) && !s.startsWith('custom:')),
      ]
    : sectionOrder

  const children: Paragraph[] = []

  // Header
  children.push(
    new Paragraph({
      children: [new TextRun({ text: basics.name ?? '', bold: true, font: headFont, size: 40 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    })
  )
  if (basics.label) {
    children.push(new Paragraph({
      children: [new TextRun({ text: basics.label, font: bodyFont, size: 24, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }))
  }
  const ensureHttps = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`
  const sep = () => new TextRun({ text: ' · ', font: bodyFont, size: 20, color: '555555' })
  const contactRuns: (TextRun | ExternalHyperlink)[] = []
  if (basics.email) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new ExternalHyperlink({ children: [new TextRun({ text: basics.email, font: bodyFont, size: 20, color: '0563C1', underline: {} })], link: `mailto:${basics.email}` }))
  }
  if (basics.phone) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new TextRun({ text: basics.phone, font: bodyFont, size: 20, color: '555555' }))
  }
  if (basics.url) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new ExternalHyperlink({ children: [new TextRun({ text: basics.url, font: bodyFont, size: 20, color: '0563C1', underline: {} })], link: ensureHttps(basics.url) }))
  }
  const contactLocation = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  if (contactLocation) {
    if (contactRuns.length) contactRuns.push(sep())
    contactRuns.push(new TextRun({ text: contactLocation, font: bodyFont, size: 20, color: '555555' }))
  }
  if (contactRuns.length) {
    children.push(new Paragraph({
      children: contactRuns,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }))
  }
  if (basics.summary) {
    children.push(sectionHeading('Summary', headFont))
    children.push(new Paragraph({
      children: [new TextRun({ text: basics.summary, font: bodyFont, size: 20 })],
      spacing: { after: 80 },
    }))
  }

  // Sections
  for (const section of orderedSections) {
    if (section.startsWith('custom:')) {
      const id = section.slice(7)
      const cs = customSections.find((s) => s.id === id)
      if (!cs || !cs.items.length) continue
      children.push(sectionHeading(cs.name, headFont))
      for (const item of cs.items) {
        if (item.title) {
          const dateText = cs.enabledFields.includes('dateRange') && (item.startDate || item.endDate)
            ? [item.startDate, item.endDate].filter(Boolean).join(' – ')
            : ''
          children.push(new Paragraph({
            children: [
              new TextRun({ text: item.title, bold: true, font: bodyFont, size: 22 }),
              ...(dateText ? [new TextRun({ text: `\t${dateText}`, font: bodyFont, size: 20, color: '666666' })] : []),
            ],
            tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
            spacing: { before: 100 },
          }))
        }
        if (cs.enabledFields.includes('subtitle') && item.subtitle) {
          children.push(new Paragraph({ children: [new TextRun({ text: item.subtitle, font: bodyFont, size: 21, color: '0066cc' })], spacing: { after: 40 } }))
        }
        if (cs.enabledFields.includes('url') && item.url) {
          children.push(new Paragraph({
            children: [new ExternalHyperlink({ children: [new TextRun({ text: item.url, font: bodyFont, size: 18, color: '0563C1', underline: {} })], link: ensureHttps(item.url) })],
            spacing: { after: 20 },
          }))
        }
        if (cs.enabledFields.includes('summary') && item.summary) {
          children.push(new Paragraph({ children: [new TextRun({ text: item.summary, font: bodyFont, size: 20 })], spacing: { after: 40 } }))
        }
        for (const h of (cs.enabledFields.includes('highlights') ? (item.highlights ?? []) : [])) {
          children.push(new Paragraph({ children: [new TextRun({ text: h, font: bodyFont, size: 20 })], bullet: { level: 0 }, spacing: { after: 20 } }))
        }
        if (cs.enabledFields.includes('keywords') && (item.keywords ?? []).length > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: (item.keywords ?? []).join(' · '), font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
        }
        if (cs.enabledFields.includes('level') && item.level) {
          children.push(new Paragraph({ children: [new TextRun({ text: `Level: ${item.level}`, font: bodyFont, size: 18, color: '555555' })], spacing: { after: 40 } }))
        }
      }
      continue
    }
    switch (section) {
      case 'work':
        if (!work.length) break
        children.push(sectionHeading('Work Experience', headFont))
        for (const job of work) {
          const dates = [job.startDate, job.endDate || 'Present'].filter(Boolean).join(' – ')
          children.push(...jobEntry(job.name ?? '', job.position ?? '', dates, job.summary, job.highlights ?? [], bodyFont))
        }
        break
      case 'education':
        if (!education.length) break
        children.push(sectionHeading('Education', headFont))
        for (const edu of education) {
          const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ')
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: edu.institution ?? '', bold: true, font: bodyFont, size: 22 }),
                new TextRun({ text: `\t${dates}`, font: bodyFont, size: 20, color: '666666' }),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
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
        children.push(sectionHeading('Skills', headFont))
        for (const s of skills) {
          const kw = (s.keywords ?? []).length > 0 ? `: ${(s.keywords ?? []).join(', ')}` : ''
          const level = s.level ? ` (${s.level})` : ''
          children.push(new Paragraph({
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
        children.push(sectionHeading('Certifications', headFont))
        for (const c of certificates) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: c.name ?? '', bold: true, font: bodyFont, size: 20 }),
              ...(c.issuer ? [new TextRun({ text: ` — ${c.issuer}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ...(c.date ? [new TextRun({ text: `\t${c.date}`, font: bodyFont, size: 20, color: '666666' })] : []),
            ],
            tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
            spacing: { after: 40 },
          }))
        }
        break
      case 'languages':
        if (!languages.length) break
        children.push(sectionHeading('Languages', headFont))
        children.push(new Paragraph({
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
        children.push(sectionHeading('Awards', headFont))
        for (const a of awards) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: a.title ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(a.date ? [new TextRun({ text: `\t${a.date}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
              spacing: { before: 100 },
            }),
            ...(a.awarder ? [new Paragraph({ children: [new TextRun({ text: a.awarder, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 20 } })] : []),
            ...(a.summary ? [new Paragraph({ children: [new TextRun({ text: a.summary, font: bodyFont, size: 20 })], spacing: { after: 80 } })] : [])
          )
        }
        break
      case 'publications':
        if (!publications.length) break
        children.push(sectionHeading('Publications', headFont))
        for (const p of publications) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(p.releaseDate ? [new TextRun({ text: `\t${p.releaseDate}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
              spacing: { before: 100 },
            }),
            ...(p.publisher ? [new Paragraph({ children: [new TextRun({ text: p.publisher, font: bodyFont, size: 20, color: '666666' })], spacing: { after: 20 } })] : []),
            ...(p.summary ? [new Paragraph({ children: [new TextRun({ text: p.summary, font: bodyFont, size: 20 })], spacing: { after: 80 } })] : [])
          )
        }
        break
      case 'volunteer':
        if (!volunteer.length) break
        children.push(sectionHeading('Volunteer', headFont))
        for (const v of volunteer) {
          const dates = [v.startDate, v.endDate || 'Present'].filter(Boolean).join(' – ')
          children.push(...jobEntry(v.organization ?? '', v.position ?? '', dates, v.summary, v.highlights ?? [], bodyFont))
        }
        break
      case 'interests':
        if (!interests.length) break
        children.push(sectionHeading('Interests', headFont))
        for (const int of interests) {
          const kw = (int.keywords ?? []).length > 0 ? `: ${(int.keywords ?? []).join(', ')}` : ''
          children.push(new Paragraph({
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
        children.push(sectionHeading('Projects', headFont))
        for (const p of projects) {
          const dates = [p.startDate, p.endDate].filter(Boolean).join(' – ')
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: p.name ?? '', bold: true, font: bodyFont, size: 22 }),
                ...(dates ? [new TextRun({ text: `\t${dates}`, font: bodyFont, size: 20, color: '666666' })] : []),
              ],
              tabStops: [{ type: 'right' as never, position: convertInchesToTwip(6.5) }],
              spacing: { before: 100 },
            }),
            ...(p.description ? [new Paragraph({ children: [new TextRun({ text: p.description, font: bodyFont, size: 20 })], spacing: { after: 40 } })] : []),
            ...(p.highlights ?? []).map(h => new Paragraph({
              children: [new TextRun({ text: h, font: bodyFont, size: 20 })],
              bullet: { level: 0 },
              spacing: { after: 20 },
            })),
            ...((p.keywords ?? []).length > 0 ? [new Paragraph({ children: [new TextRun({ text: (p.keywords ?? []).join(', '), font: bodyFont, size: 18, color: '666666' })], spacing: { after: 80 } })] : [])
          )
        }
        break
    }
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
      children,
    }],
  })
}
